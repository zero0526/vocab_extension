import type { VocabularyEntry, AnkiExport } from "@vocab-extend/shared";
import { db } from "../../db/database";
import { generateUUID } from "../../utils/text";

export interface AnkiConnectResponse<T = unknown> {
  result: T;
  error: string | null;
}

export class AnkiClient {
  private ankiUrl: string;

  constructor(ankiUrl = "http://127.0.0.1:8765") {
    this.ankiUrl = ankiUrl;
  }

  private async invoke<T = unknown>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    const res = await fetch(this.ankiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, version: 6, params }),
    });

    if (!res.ok) {
      throw new Error(`AnkiConnect HTTP error: ${res.status} ${res.statusText}`);
    }

    const data: AnkiConnectResponse<T> = await res.json();
    if (data.error) {
      throw new Error(data.error);
    }
    return data.result;
  }

  async checkConnection(): Promise<boolean> {
    try {
      const version = await this.invoke<number>("version");
      return typeof version === "number";
    } catch {
      return false;
    }
  }

  async getDeckNames(): Promise<string[]> {
    return this.invoke<string[]>("deckNames");
  }

  async createDeck(deck: string): Promise<number> {
    const cleanDeck = deck.trim();
    if (!cleanDeck) {
      throw new Error("Tên deck không được để trống");
    }
    return this.invoke<number>("createDeck", { deck: cleanDeck });
  }

  async getModelNames(): Promise<string[]> {
    return this.invoke<string[]>("modelNames");
  }

  async getModelFieldNames(modelName: string): Promise<string[]> {
    return this.invoke<string[]>("modelFieldNames", { modelName });
  }

  /**
   * Convert VocabularyEntry to standard Anki Note fields
   */
  buildNoteFields(entry: VocabularyEntry, availableFields: string[]): Record<string, string> {
    const pos = entry.types.map((t) => t.name).join(", ");
    const ipa = entry.pronunciations
      .map((p) => `${p.dialect ? `[${p.dialect}] ` : ""}${p.variants.map((v) => v.ipa).join(" ")}`)
      .join(" · ");

    const meaningsHtml = entry.meanings
      .map((m, i) => `<div>${entry.meanings.length > 1 ? `${i + 1}. ` : ""}<b>${m.text}</b>${m.context ? ` <i>(${m.context})</i>` : ""}</div>`)
      .join("");

    const examplesHtml = entry.examples
      .map((e) => `<div>• <i>${e.sentence}</i>${e.source ? ` <small>[${e.source}]</small>` : ""}</div>`)
      .join("");

    const memoryHtml = entry.memory ? `<div>💡 <i>${entry.memory}</i></div>` : "";

    const fullBack = [
      ipa ? `<div style="color: #6366f1;">${ipa}</div>` : "",
      pos ? `<div style="color: #64748b; font-style: italic;">${pos}</div>` : "",
      meaningsHtml ? `<div style="margin-top: 8px;">${meaningsHtml}</div>` : "",
      examplesHtml ? `<div style="margin-top: 8px;">${examplesHtml}</div>` : "",
      memoryHtml ? `<div style="margin-top: 8px;">${memoryHtml}</div>` : "",
    ].filter(Boolean).join("");

    const fieldMap: Record<string, string> = {};

    // Standard "Basic" model has Front & Back
    if (availableFields.includes("Front") && availableFields.includes("Back")) {
      fieldMap["Front"] = entry.word;
      fieldMap["Back"] = fullBack;
    } else {
      // Fallback matching
      for (const f of availableFields) {
        const lower = f.toLowerCase();
        if (lower.includes("word") || lower.includes("front")) fieldMap[f] = entry.word;
        else if (lower.includes("meaning") || lower.includes("back")) fieldMap[f] = fullBack;
        else if (lower.includes("ipa") || lower.includes("phonetic")) fieldMap[f] = ipa;
        else if (lower.includes("example")) fieldMap[f] = examplesHtml;
        else fieldMap[f] = "";
      }
    }

    return fieldMap;
  }

  async exportBatch(
    entries: VocabularyEntry[],
    deckName: string,
    modelName = "Basic",
    tags: string[] = ["vocab-extend"]
  ): Promise<AnkiExport[]> {
    const availableFields = await this.getModelFieldNames(modelName);
    const results: AnkiExport[] = [];

    for (const entry of entries) {
      const exportId = generateUUID();
      const fields = this.buildNoteFields(entry, availableFields);

      try {
        const noteId = await this.invoke<number>("addNote", {
          note: {
            deckName,
            modelName,
            fields,
            tags: [...tags, entry.capture.dateKey],
          },
        });

        const record: AnkiExport = {
          id: exportId,
          vocabularyId: entry.id,
          deckName,
          noteId,
          status: "success",
          exportedAt: new Date().toISOString(),
        };

        results.push(record);
        await db.ankiExports.put(record);
        await db.vocabulary.update(entry.id, {
          status: "exported",
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const record: AnkiExport = {
          id: exportId,
          vocabularyId: entry.id,
          deckName,
          status: "failed",
          error: errorMessage,
          exportedAt: new Date().toISOString(),
        };
        results.push(record);
        await db.ankiExports.put(record);
      }
    }

    return results;
  }
}

export const ankiClient = new AnkiClient();
