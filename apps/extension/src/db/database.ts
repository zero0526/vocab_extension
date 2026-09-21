import Dexie, { type Table } from "dexie";
import type { VocabularyEntry, AnkiExport } from "@vocab-extend/shared";

export interface AppSetting {
  key: string;
  value: unknown;
}

export class VocabularyDatabase extends Dexie {
  vocabulary!: Table<VocabularyEntry, string>;
  ankiExports!: Table<AnkiExport, string>;
  settings!: Table<AppSetting, string>;

  constructor() {
    super("vocab-extend-db");

    this.version(1).stores({
      vocabulary: [
        "id",
        "normalizedWord",
        "status",
        "capture.dateKey",
        "createdAt",
        "updatedAt",
        "[normalizedWord+capture.dateKey]",
      ].join(", "),
      ankiExports: "id, vocabularyId, deckName, status, exportedAt",
      settings: "key",
    });
  }
}

export const db = new VocabularyDatabase();
