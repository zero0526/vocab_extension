import type { DictionaryClient, DictionaryLookupResult } from "./types";
import { parseCambridgeHtml } from "./cambridge-parser";
import { cambridgeAuth } from "./cambridge-auth";
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
   * Fetch dictionary entry:
   * 1. Thử cào trực tiếp từ Cambridge Dictionary dùng Cookie/Token thật trong trình duyệt (credentials: "include")
   * 2. Nếu cookie hết hạn (HTTP 403), tự động fallback sang DictionaryAPI tốc độ cao
   */
  async lookup(word: string): Promise<DictionaryLookupResult> {
    const cleanWord = word.trim();
    if (!cleanWord) {
      throw new Error("Vui lòng nhập từ cần tra");
    }

    const cambridgeUrl = `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(cleanWord.toLowerCase())}`;
    const apiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord.toLowerCase())}`;

    // 1. Thử fetch Cambridge với cookie trình duyệt (cf_clearance)
    try {
      const res = await fetch(cambridgeUrl, {
        method: "GET",
        credentials: "include", // Tự động gửi cookie cf_clearance từ kho cookie của Chrome
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
        },
      });

      if (res.ok) {
        const htmlText = await res.text();
        // Xác nhận đây là HTML từ điển thực tế chứ không phải trang challenge 403
        if (
          htmlText.includes("headword") ||
          htmlText.includes("pron-block") ||
          htmlText.includes("pr dictionary")
        ) {
          const parsed = parseCambridgeHtml(htmlText, cleanWord);
          if (parsed.meanings.length > 0 || parsed.pronunciations.length > 0) {
            return parsed;
          }
        }
      } else if (res.status === 403) {
        console.warn("Cambridge trả về 403 (cookie cf_clearance cần được làm mới).");
      }
    } catch (err) {
      console.warn("Không thể fetch trực tiếp Cambridge:", err);
    }

    // 2. Fallback: Dictionary API (Đảm bảo luôn có từ loại, phát âm MP3, định nghĩa ngay lập tức)
    try {
      const res = await fetch(apiUrl);
      if (res.ok) {
        const data = (await res.json()) as ApiEntry[];
        if (Array.isArray(data) && data.length > 0) {
          return this.parseApiResponse(data[0], cleanWord, cambridgeUrl);
        }
      }
    } catch (err) {
      console.warn("Lỗi gọi Dictionary API:", err);
    }

    throw new Error(
      `Không tìm thấy dữ liệu từ điển cho từ "${cleanWord}". Vui lòng thử lại hoặc bấm "Làm mới Token Cambridge".`
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
                source: "Cambridge Dictionary",
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
        dictionary: "Cambridge",
        url: cambridgeUrl,
      },
    };
  }
}

export const dictionaryClient = new CambridgeAdapter();
