import type {
  WordType,
  Pronunciation,
  AudioResource,
  Meaning,
  Example,
  DictionarySource,
  VocabularyEntry,
} from "@vocab-extend/shared";

export interface DictionaryLookupOptions {
  forceRemote?: boolean;
}

export interface DictionaryLookupResult {
  word: string;
  types: WordType[];
  pronunciations: Pronunciation[];
  audio: AudioResource[];
  meanings: Meaning[];
  examples: Example[];
  source: DictionarySource;
  fromDb?: boolean;
  existingEntry?: VocabularyEntry;
  isInAnki?: boolean;
  ankiNoteId?: number;
  ankiDeckName?: string;
}

export interface DictionaryClient {
  lookup(
    word: string,
    options?: DictionaryLookupOptions
  ): Promise<DictionaryLookupResult>;
}

