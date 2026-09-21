import { db } from "./database";
export class VocabularyRepository {
    async getById(id) {
        return db.vocabulary.get(id);
    }
    async findByWordAndDate(normalizedWord, dateKey) {
        return db.vocabulary
            .where("[normalizedWord+capture.dateKey]")
            .equals([normalizedWord, dateKey])
            .first();
    }
    async findByWord(normalizedWord) {
        return db.vocabulary
            .where("normalizedWord")
            .equals(normalizedWord)
            .toArray();
    }
    async listByDate(dateKey) {
        return db.vocabulary
            .where("capture.dateKey")
            .equals(dateKey)
            .reverse()
            .sortBy("createdAt");
    }
    async listAll(limit = 100) {
        return db.vocabulary
            .orderBy("createdAt")
            .reverse()
            .limit(limit)
            .toArray();
    }
    async listByStatus(status) {
        return db.vocabulary
            .where("status")
            .equals(status)
            .toArray();
    }
    async save(entry) {
        await db.vocabulary.put(entry);
    }
    async updateStatus(id, status) {
        await db.vocabulary.update(id, {
            status,
            updatedAt: new Date().toISOString(),
        });
    }
    async update(id, patch) {
        await db.vocabulary.update(id, {
            ...patch,
            updatedAt: new Date().toISOString(),
        });
    }
    async delete(id) {
        await db.vocabulary.delete(id);
    }
}
export const vocabularyRepository = new VocabularyRepository();
