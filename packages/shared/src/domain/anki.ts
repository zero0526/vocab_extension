export interface AnkiDeck {
  name: string;
}

export interface AnkiModel {
  name: string;
  fieldNames: string[];
}

export interface AnkiNoteInput {
  deckName: string;
  modelName: string;
  fields: Record<string, string>;
  tags: string[];
}

export interface AnkiExport {
  id: string;
  vocabularyId: string;
  deckName: string;
  noteId?: number;
  status: "success" | "failed";
  error?: string;
  exportedAt: string;
}
