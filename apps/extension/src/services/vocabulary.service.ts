import type {
  VocabularyEntry,
  VocabularyFormData,
  VocabularyStatus,
} from "@vocab-extend/shared";
import { vocabularyRepository } from "../db/vocabulary.repository";
import { normalizeWord, generateUUID } from "../utils/text";
import { getLocalDateKey } from "../utils/date";

export interface SaveVocabularyOptions {
  updateId?: string;
  forceNew?: boolean;
}

export async function saveVocabulary(
  data: VocabularyFormData,
  options?: SaveVocabularyOptions
): Promise<VocabularyEntry> {
  const now = new Date().toISOString();
  const normalized = normalizeWord(data.word);

  let existing: VocabularyEntry | undefined;

  if (options?.updateId) {
    existing = await vocabularyRepository.getById(options.updateId);
  } else if (!options?.forceNew) {
    existing = await vocabularyRepository.findByWordAndDate(
      normalized,
      data.capture.dateKey
    );
  }

  const hasMeaning = data.meanings.some((m) => m.text.trim().length > 0);
  const status: VocabularyStatus = existing?.status === "exported"
    ? "exported"
    : hasMeaning
      ? "enriched"
      : "captured";

  const entry: VocabularyEntry = {
    ...data,
    id: options?.forceNew ? generateUUID() : (existing?.id ?? generateUUID()),
    normalizedWord: normalized,
    status,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await vocabularyRepository.save(entry);
  return entry;
}

export async function updateVocabulary(
  id: string,
  data: VocabularyFormData
): Promise<VocabularyEntry> {
  const existing = await vocabularyRepository.getById(id);
  if (!existing) {
    throw new Error(`Không tìm thấy từ vựng có id: ${id}`);
  }

  const now = new Date().toISOString();
  const normalized = normalizeWord(data.word);
  const hasMeaning = data.meanings.some((m) => m.text.trim().length > 0);
  const status: VocabularyStatus = existing.status === "exported"
    ? "exported"
    : hasMeaning
      ? "enriched"
      : "captured";

  const updated: VocabularyEntry = {
    ...data,
    id: existing.id,
    normalizedWord: normalized,
    status,
    createdAt: existing.createdAt,
    updatedAt: now,
  };

  await vocabularyRepository.save(updated);
  return updated;
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
