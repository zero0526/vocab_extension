import type { DictionaryClient, DictionaryLookupResult } from "./types";
import { parseCambridgeHtml } from "./cambridge-parser";

export class CambridgeAdapter implements DictionaryClient {
  /**
   * Directly fetch and parse Cambridge Dictionary HTML using standard fetch.
   * No backend / Playwright required.
   */
  async lookup(word: string): Promise<DictionaryLookupResult> {
    const cleanWord = word.trim();
    if (!cleanWord) {
      throw new Error("Word cannot be empty");
    }

    const targetUrl = `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(cleanWord.toLowerCase())}`;

    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!res.ok) {
      throw new Error(`Không thể kết nối đến Cambridge Dictionary (HTTP ${res.status})`);
    }

    const htmlText = await res.text();
    return parseCambridgeHtml(htmlText, cleanWord);
  }
}

export const dictionaryClient = new CambridgeAdapter();
