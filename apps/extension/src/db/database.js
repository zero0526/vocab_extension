import Dexie from "dexie";
export class VocabularyDatabase extends Dexie {
    vocabulary;
    ankiExports;
    settings;
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
