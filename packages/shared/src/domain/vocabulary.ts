export type GrammarPattern = {
  label: string;
  description?: string;
};

export type WordType = {
  name: string;
  patterns: GrammarPattern[];
};

export type PronunciationVariant = {
  type?: "standard" | "strong" | "weak" | string;
  ipa: string;
};

export type Pronunciation = {
  dialect?: "UK" | "US" | "AU" | "OTHER" | string;
  variants: PronunciationVariant[];
};

export type AudioResource = {
  dialect?: string;
  url?: string;
  source?: string;
  base64?: string;
  filename?: string;
};

export type Meaning = {
  id: string;
  text: string;
  context?: string;
  source: "user" | "dictionary";
};

export type Example = {
  id: string;
  sentence: string;
  translation?: string;
  source?: string;
  sourceUrl?: string;
  sourceType: "document" | "dictionary" | "user";
};

export type DictionarySource = {
  dictionary?: string;
  url?: string;
};

export type CaptureMetadata = {
  sourceUrl?: string;
  sourceTitle?: string;
  selectedText?: string;
  capturedAt: string;
  dateKey: string; // YYYY-MM-DD
};

export type VocabularyStatus =
  | "captured"
  | "enriched"
  | "reviewed"
  | "exported";

export interface VocabularyEntry {
  id: string;
  word: string;
  normalizedWord: string;

  types: WordType[];
  pronunciations: Pronunciation[];
  audio: AudioResource[];

  meanings: Meaning[];
  examples: Example[];

  memory?: string;
  source?: DictionarySource;

  capture: CaptureMetadata;
  status: VocabularyStatus;

  createdAt: string;
  updatedAt: string;
}
