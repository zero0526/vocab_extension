import type {
  VocabularyEntry,
  VocabularyFormData,
  VocabularyStatus,
} from "@vocab-extend/shared";
import { vocabularyRepository } from "../db/vocabulary.repository";
import { normalizeWord, generateUUID } from "../utils/text";
import { getLocalDateKey } from "../utils/date";

export async function saveVocabulary(
  data: VocabularyFormData
): Promise<VocabularyEntry> {
  const now = new Date().toISOString();
  const normalized = normalizeWord(data.word);

  const existing = await vocabularyRepository.findByWordAndDate(
    normalized,
    data.capture.dateKey
  );

  const entry: VocabularyEntry = {
    ...data,
    id: existing?.id ?? generateUUID(),
    normalizedWord: normalized,
    status: (existing?.status === "exported" ? "exported" : "enriched") as VocabularyStatus,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await vocabularyRepository.save(entry);
  return entry;
}

export async function getTodayVocabulary(): Promise<VocabularyEntry[]> {
  const todayKey = getLocalDateKey();
  return vocabularyRepository.listByDate(todayKey);
}

export function createInitialFormData(
  word: string,
  sourceUrl = "",
  sourceTitle = ""
): VocabularyFormData {
  const now = new Date();
  return {
    word: word.trim(),
    types: [],
    pronunciations: [],
    audio: [],
    meanings: [
      {
        id: generateUUID(),
        text: "",
        context: "",
        source: "user",
      },
    ],
    examples: [],
    memory: "",
    source: {
      dictionary: "Cambridge",
    },
    capture: {
      sourceUrl,
      sourceTitle,
      selectedText: word,
      capturedAt: now.toISOString(),
      dateKey: getLocalDateKey(now),
    },
  };
}
