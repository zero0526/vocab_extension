import { db } from "./database";
import type { VocabularyEntry, VocabularyStatus } from "@vocab-extend/shared";

export class VocabularyRepository {
  async getById(id: string): Promise<VocabularyEntry | undefined> {
    return db.vocabulary.get(id);
  }

  async findByWordAndDate(
    normalizedWord: string,
    dateKey: string
  ): Promise<VocabularyEntry | undefined> {
    return db.vocabulary
      .where("[normalizedWord+capture.dateKey]")
      .equals([normalizedWord, dateKey])
      .first();
  }

  async findByWord(normalizedWord: string): Promise<VocabularyEntry[]> {
    return db.vocabulary
      .where("normalizedWord")
      .equals(normalizedWord)
      .toArray();
  }

  async listByDate(dateKey: string): Promise<VocabularyEntry[]> {
    return db.vocabulary
      .where("capture.dateKey")
      .equals(dateKey)
      .reverse()
      .sortBy("createdAt");
  }

  async listAll(limit = 100): Promise<VocabularyEntry[]> {
    return db.vocabulary
      .orderBy("createdAt")
      .reverse()
      .limit(limit)
      .toArray();
  }

  async listByStatus(status: VocabularyStatus): Promise<VocabularyEntry[]> {
    return db.vocabulary
      .where("status")
      .equals(status)
      .toArray();
  }

  async save(entry: VocabularyEntry): Promise<void> {
    await db.vocabulary.put(entry);
  }

  async updateStatus(id: string, status: VocabularyStatus): Promise<void> {
    await db.vocabulary.update(id, {
      status,
      updatedAt: new Date().toISOString(),
    });
  }

  async update(id: string, patch: Partial<VocabularyEntry>): Promise<void> {
    await db.vocabulary.update(id, {
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  }

  async delete(id: string): Promise<void> {
    await db.vocabulary.delete(id);
  }
}

export const vocabularyRepository = new VocabularyRepository();
