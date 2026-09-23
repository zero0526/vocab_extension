import { db } from "./database";
import type { VocabularyEntry, VocabularyStatus, AnkiExport } from "@vocab-extend/shared";

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

  async findLatestByWord(normalizedWord: string): Promise<VocabularyEntry | undefined> {
    const list = await this.findByWord(normalizedWord);
    if (list.length === 0) return undefined;
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }

  async getAnkiExportByVocabularyId(vocabularyId: string): Promise<AnkiExport | undefined> {
    return db.ankiExports
      .where("vocabularyId")
      .equals(vocabularyId)
      .first();
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
