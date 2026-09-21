import type {
  WordType,
  Pronunciation,
  AudioResource,
  Meaning,
  Example,
  DictionarySource,
} from "@vocab-extend/shared";

export interface DictionaryLookupResult {
  word: string;
  types: WordType[];
  pronunciations: Pronunciation[];
  audio: AudioResource[];
  meanings: Meaning[];
  examples: Example[];
  source: DictionarySource;
}

export interface DictionaryClient {
  lookup(word: string): Promise<DictionaryLookupResult>;
}
