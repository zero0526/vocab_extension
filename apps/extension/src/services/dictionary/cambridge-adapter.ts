import type { DictionaryClient, DictionaryLookupResult } from "./types";
import { parseCambridgeHtml } from "./cambridge-parser";
import { generateUUID } from "../../utils/text";
import type { WordType, Pronunciation, AudioResource, Meaning, Example } from "@vocab-extend/shared";

export interface ApiPhonetic {
  text?: string;
  audio?: string;
}

export interface ApiDefinition {
  definition?: string;
  example?: string;
}

export interface ApiMeaning {
  partOfSpeech?: string;
  definitions?: ApiDefinition[];
}

export interface ApiEntry {
  word?: string;
  phonetic?: string;
  phonetics?: ApiPhonetic[];
  meanings?: ApiMeaning[];
}

export class CambridgeAdapter implements DictionaryClient {
  /**
   * Fetch dictionary entry.
   * Primary: https://api.dictionaryapi.dev/api/v2/entries/en/<word> (fast, no Cloudflare captcha, includes real audio mp3s)
   * Fallback: https://dictionary.cambridge.org/dictionary/english/<word>
   */
  async lookup(word: string): Promise<DictionaryLookupResult> {
    const cleanWord = word.trim();
    if (!cleanWord) {
      throw new Error("Vui lòng nhập từ cần tra");
    }

    const cambridgeUrl = `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(cleanWord.toLowerCase())}`;
    const apiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord.toLowerCase())}`;

    // 1. Primary: Dictionary API (High speed, reliable, no Cloudflare block)
    try {
      const res = await fetch(apiUrl);
      if (res.ok) {
        const data = (await res.json()) as ApiEntry[];
        if (Array.isArray(data) && data.length > 0) {
          return this.parseApiResponse(data[0], cleanWord, cambridgeUrl);
        }
      }
    } catch (err) {
      console.warn("Lỗi gọi Dictionary API, thử fallback sang Cambridge:", err);
    }

    // 2. Fallback: Direct Cambridge Dictionary fetch
    try {
      const res = await fetch(cambridgeUrl, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
        },
      });

      if (res.ok) {
        const htmlText = await res.text();
        if (
          htmlText.includes("headword") ||
          htmlText.includes("pron-block") ||
          htmlText.includes("pr dictionary")
        ) {
          return parseCambridgeHtml(htmlText, cleanWord);
        }
      }
    } catch (err) {
      console.warn("Direct Cambridge fetch error:", err);
    }

    throw new Error(
      `Không tìm thấy dữ liệu từ điển cho từ "${cleanWord}". Vui lòng kiểm tra lại chính tả hoặc nhập nghĩa thủ công.`
    );
  }

  public parseApiResponse(
    item: ApiEntry,
    word: string,
    cambridgeUrl: string
  ): DictionaryLookupResult {
    const types: WordType[] = [];
    const pronunciations: Pronunciation[] = [];
    const audio: AudioResource[] = [];
    const meanings: Meaning[] = [];
    const examples: Example[] = [];

    // Phonetics & Audio
    let standardIpa = item.phonetic || "";
    if (Array.isArray(item.phonetics)) {
      for (const p of item.phonetics) {
        if (!standardIpa && p.text) standardIpa = p.text;
        if (p.audio) {
          const isUk = p.audio.includes("-uk") || p.audio.includes("/uk/");
          const isUs = p.audio.includes("-us") || p.audio.includes("/us/");
          const dialect = isUk ? "UK" : isUs ? "US" : audio.length === 0 ? "US" : undefined;
          if (dialect && !audio.some((a) => a.dialect === dialect)) {
            audio.push({ dialect, url: p.audio, source: "DictionaryAPI" });
          }
        }
      }
    }

    if (standardIpa) {
      pronunciations.push(
        { dialect: "UK", variants: [{ type: "standard", ipa: standardIpa }] },
        { dialect: "US", variants: [{ type: "standard", ipa: standardIpa }] }
      );
    }

    // Meanings, POS, and Examples
    if (Array.isArray(item.meanings)) {
      for (const m of item.meanings) {
        if (m.partOfSpeech && !types.some((t) => t.name === m.partOfSpeech)) {
          types.push({ name: m.partOfSpeech, patterns: [] });
        }
        if (Array.isArray(m.definitions)) {
          for (const d of m.definitions) {
            if (d.definition && meanings.length < 5) {
              meanings.push({
                id: generateUUID(),
                text: d.definition,
                context: m.partOfSpeech || "",
                source: "dictionary",
              });
            }
            if (d.example && examples.length < 3) {
              examples.push({
                id: generateUUID(),
                sentence: d.example,
                source: "Dictionary Examples",
                sourceUrl: cambridgeUrl,
                sourceType: "dictionary",
              });
            }
          }
        }
      }
    }

    return {
      word: item.word || word,
      types,
      pronunciations,
      audio,
      meanings,
      examples,
      source: {
        dictionary: "DictionaryAPI",
        url: cambridgeUrl,
      },
    };
  }
}

export const dictionaryClient = new CambridgeAdapter();
