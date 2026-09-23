import type { VocabularyEntry, AnkiExport } from "@vocab-extend/shared";
import { db } from "../../db/database";
import { generateUUID } from "../../utils/text";
import {
  buildCardHtml,
  formatMeaningsHtml,
  formatExamplesHtml,
  formatPronunciationsHtml,
  formatWordTypesHtml,
  formatMemoryHtml,
} from "./anki-card-formatter";

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
   * Tải và nạp các file audio của từ vựng vào kho lưu trữ media của Anki
   */
  async uploadMediaFilesForEntry(entry: VocabularyEntry): Promise<string[]> {
    const soundTags: string[] = [];

    for (const a of entry.audio) {
      if (!a.url && !a.base64) continue;
      const dialect = (a.dialect || "audio").toLowerCase();
      const safeWord = entry.normalizedWord.replace(/[^a-z0-9]/g, "_");
      const filename = a.filename || `vocab_${safeWord}_${dialect}.mp3`;

      try {
        if (a.base64) {
          const rawBase64 = a.base64.includes(",") ? a.base64.split(",")[1] : a.base64;
          await this.invoke("storeMediaFile", {
            filename,
            data: rawBase64,
          });
          soundTags.push(`[sound:${filename}]`);
        } else if (a.url) {
          await this.invoke("storeMediaFile", {
            filename,
            url: a.url,
          });
          soundTags.push(`[sound:${filename}]`);
        }
      } catch (err) {
        console.warn(`Lỗi nạp audio ${filename} vào Anki:`, err);
      }
    }

    return soundTags;
  }

  /**
   * Convert VocabularyEntry to standard Anki Note fields with rich HTML styling
   */
  buildNoteFields(
    entry: VocabularyEntry,
    availableFields: string[],
    soundTags: string[] = []
  ): Record<string, string> {
    const fullBack = buildCardHtml(entry, soundTags);
    const meaningsHtml = formatMeaningsHtml(entry.meanings);
    const examplesHtml = formatExamplesHtml(entry.examples);
    const ipaHtml = formatPronunciationsHtml(entry.pronunciations, soundTags);
    const posHtml = formatWordTypesHtml(entry.types);
    const memoryHtml = formatMemoryHtml(entry.memory);

    const fieldMap: Record<string, string> = {};

    // Standard "Basic" model has Front & Back
    if (availableFields.includes("Front") && availableFields.includes("Back")) {
      fieldMap["Front"] = entry.word;
      fieldMap["Back"] = fullBack;
    } else {
      // Fallback matching for customized or multi-field models
      for (const f of availableFields) {
        const lower = f.toLowerCase();
        if (lower.includes("word") || lower.includes("front")) fieldMap[f] = entry.word;
        else if (lower.includes("meaning") || lower.includes("back")) fieldMap[f] = fullBack;
        else if (lower.includes("ipa") || lower.includes("phonetic") || lower.includes("pronunciation")) fieldMap[f] = ipaHtml;
        else if (lower.includes("example")) fieldMap[f] = examplesHtml;
        else if (lower.includes("pos") || lower.includes("part of speech") || lower.includes("type")) fieldMap[f] = posHtml;
        else if (lower.includes("memory") || lower.includes("hint") || lower.includes("note")) fieldMap[f] = memoryHtml;
        else if (lower.includes("audio") || lower.includes("sound")) fieldMap[f] = soundTags.join(" ");
        else fieldMap[f] = "";
      }
    }

    // Gán trường Audio riêng nếu model có hỗ trợ
    const dedicatedAudioField = availableFields.find((f) => {
      const lower = f.toLowerCase();
      return lower.includes("audio") || lower.includes("sound");
    });
    if (dedicatedAudioField && soundTags.length > 0) {
      fieldMap[dedicatedAudioField] = soundTags.join(" ");
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

      // Nạp media audio vào Anki trước
      const soundTags = await this.uploadMediaFilesForEntry(entry);
      const fields = this.buildNoteFields(entry, availableFields, soundTags);

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

  /**
   * Lấy thông tin chi tiết của note trên Anki (bao gồm modelName, fields)
   */
  async getNoteInfo(noteId: number): Promise<{ noteId: number; modelName: string; fields: Record<string, { value: string }> } | null> {
    try {
      const info = await this.invoke<Array<{ noteId: number; modelName: string; fields: Record<string, { value: string }> }>>("notesInfo", {
        notes: [noteId],
      });
      if (Array.isArray(info) && info.length > 0 && info[0].noteId) {
        return info[0];
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Kiểm tra note có tồn tại trên Anki hay không
   */
  async checkNoteExists(noteId: number): Promise<boolean> {
    const info = await this.getNoteInfo(noteId);
    return info !== null;
  }

  /**
   * Tìm danh sách Note ID theo từ khóa trên Anki
   */
  async findNotesByWord(word: string, deckName?: string): Promise<number[]> {
    try {
      const cleanWord = word.trim().replace(/"/g, '\\"');
      const query = deckName ? `deck:"${deckName}" "${cleanWord}"` : `"${cleanWord}"`;
      return await this.invoke<number[]>("findNotes", { query });
    } catch {
      return [];
    }
  }

  /**
   * Cập nhật các trường thông tin của thẻ đã tồn tại trong Anki
   */
  async updateNote(noteId: number, entry: VocabularyEntry): Promise<void> {
    const noteInfo = await this.getNoteInfo(noteId);
    const modelName = noteInfo?.modelName || "Basic";

    const availableFields = await this.getModelFieldNames(modelName);
    const soundTags = await this.uploadMediaFilesForEntry(entry);
    const fields = this.buildNoteFields(entry, availableFields, soundTags);

    await this.invoke("updateNoteFields", {
      note: {
        id: noteId,
        fields,
      },
    });

    // Cập nhật trạng thái trong local DB
    const existingExport = await db.ankiExports.where("vocabularyId").equals(entry.id).first();
    if (existingExport) {
      await db.ankiExports.update(existingExport.id, {
        noteId,
        status: "success",
        exportedAt: new Date().toISOString(),
      });
    }

    await db.vocabulary.update(entry.id, {
      status: "exported",
      updatedAt: new Date().toISOString(),
    });
  }
}


export const ankiClient = new AnkiClient();
