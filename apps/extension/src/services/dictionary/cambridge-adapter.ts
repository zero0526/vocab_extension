import type { DictionaryClient, DictionaryLookupResult, DictionaryLookupOptions } from "./types";
import { parseCambridgeHtml } from "./cambridge-parser";
import { fetchCambridgeHtmlViaTab } from "./cambridge-tab-fetcher";
import { cambridgeAuth } from "./cambridge-auth";
import { generateUUID, normalizeWord } from "../../utils/text";

import { vocabularyRepository } from "../../db/vocabulary.repository";
import type {
  WordType,
  Pronunciation,
  AudioResource,
  Meaning,
  Example,
  VocabularyEntry,
  AnkiExport,
} from "@vocab-extend/shared";

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
   * 1. Kiểm tra từ đã lưu trong Local IndexedDB chưa. Nếu có: trả về ngay ("kéo mới ra") kèm trạng thái Anki
   * 2. Nếu chưa lưu (hoặc options.forceRemote === true): Cào trực tiếp từ Cambridge (credentials: "include")
   * 3. Fallback sang DictionaryAPI nếu Cambridge gặp lỗi
   */
  async lookup(
    word: string,
    options?: DictionaryLookupOptions
  ): Promise<DictionaryLookupResult> {
    const cleanWord = word.trim();
    if (!cleanWord) {
      throw new Error("Vui lòng nhập từ cần tra");
    }

    const normalized = normalizeWord(cleanWord);

    // Kiểm tra thông tin đã lưu trong DB & Anki
    let existing: VocabularyEntry | undefined;
    let ankiExport: AnkiExport | undefined;
    let isInAnki = false;

    try {
      existing = await vocabularyRepository.findLatestByWord(normalized);
      if (existing) {
        ankiExport = await vocabularyRepository.getAnkiExportByVocabularyId(existing.id);
        isInAnki = existing.status === "exported" || Boolean(ankiExport?.noteId);
      }
    } catch (dbErr) {
      console.warn("Lỗi kiểm tra từ trong IndexedDB:", dbErr);
    }

    // Nếu đã lưu trong DB và không yêu cầu cào lại (forceRemote) -> Kéo từ DB ra
    if (!options?.forceRemote && existing) {
      return {
        word: existing.word,
        types: existing.types,
        pronunciations: existing.pronunciations,
        audio: existing.audio,
        meanings: existing.meanings,
        examples: existing.examples,
        source: existing.source || { dictionary: "Cambridge" },
        fromDb: true,
        existingEntry: existing,
        isInAnki,
        ankiNoteId: ankiExport?.noteId,
        ankiDeckName: ankiExport?.deckName,
      };
    }

    const cambridgeSlug = encodeURIComponent(cleanWord.toLowerCase().replace(/\s+/g, "-"));
    const cambridgeUrl = `https://dictionary.cambridge.org/dictionary/english/${cambridgeSlug}`;
    const apiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord.toLowerCase())}`;

    // 1. Thử fetch Cambridge trực tiếp với cookie trình duyệt (cf_clearance)
    try {
      const res = await fetch(cambridgeUrl, {
        method: "GET",
        credentials: "include", // Tự động gửi cookie từ kho cookie của Chrome
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
            if (existing) {
              parsed.existingEntry = existing;
              parsed.isInAnki = isInAnki;
              parsed.ankiNoteId = ankiExport?.noteId;
              parsed.ankiDeckName = ankiExport?.deckName;
            }
            return parsed;
          }
        }
      } else if (res.status === 403) {
        console.info("Cambridge direct fetch bị Cloudflare chặn (403), chuyển sang V8 Tab Engine...");
      }
    } catch (err) {
      console.info("Không thể fetch trực tiếp Cambridge, thử qua V8 Tab Engine:", err);
    }

    // 2. Thử giải Cloudflare qua Tab thật của Chrome (V8 Tab Engine ngầm)
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.scripting) {
      try {
        const tabHtml = await fetchCambridgeHtmlViaTab(cambridgeUrl);
        if (
          tabHtml.includes("headword") ||
          tabHtml.includes("pron-block") ||
          tabHtml.includes("pr dictionary")
        ) {
          const parsed = parseCambridgeHtml(tabHtml, cleanWord);
          if (parsed.meanings.length > 0 || parsed.pronunciations.length > 0) {
            if (existing) {
              parsed.existingEntry = existing;
              parsed.isInAnki = isInAnki;
              parsed.ankiNoteId = ankiExport?.noteId;
              parsed.ankiDeckName = ankiExport?.deckName;
            }
            return parsed;
          }
        }
      } catch (tabErr) {
        console.info("Không thể cào qua V8 tab engine, chuyển sang DictionaryAPI fallback:", tabErr);
      }
    }

    // 3. Fallback: Dictionary API (Đảm bảo luôn có từ loại, phát âm MP3, định nghĩa ngay lập tức)
    try {
      const res = await fetch(apiUrl);
      if (res.ok) {
        const data = (await res.json()) as ApiEntry[];
        if (Array.isArray(data) && data.length > 0) {
          const apiResult = this.parseApiResponse(data[0], cleanWord, cambridgeUrl);
          if (existing) {
            apiResult.existingEntry = existing;
            apiResult.isInAnki = isInAnki;
            apiResult.ankiNoteId = ankiExport?.noteId;
            apiResult.ankiDeckName = ankiExport?.deckName;
          }
          return apiResult;
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
