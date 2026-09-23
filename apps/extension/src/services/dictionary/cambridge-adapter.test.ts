import { describe, expect, it, vi, beforeEach } from "vitest";
import { CambridgeAdapter } from "./cambridge-adapter";
import { vocabularyRepository } from "../../db/vocabulary.repository";
import type { VocabularyEntry, AnkiExport } from "@vocab-extend/shared";

describe("CambridgeAdapter Lookup with DB & Anki Check", () => {
  const adapter = new CambridgeAdapter();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns existing entry from IndexedDB when word is found without calling fetch", async () => {
    const mockEntry: VocabularyEntry = {
      id: "vocab-123",
      word: "reconcile",
      normalizedWord: "reconcile",
      types: [{ name: "verb", patterns: [] }],
      pronunciations: [{ dialect: "UK", variants: [{ ipa: "/ˈrek.ən.saɪl/" }] }],
      audio: [],
      meanings: [{ id: "m-1", text: "To restore friendly relations", source: "user" }],
      examples: [],
      memory: "re + concile",
      status: "exported",
      createdAt: "2026-09-20T10:00:00.000Z",
      updatedAt: "2026-09-20T10:00:00.000Z",
      capture: {
        capturedAt: "2026-09-20T10:00:00.000Z",
        dateKey: "2026-09-20",
      },
    };

    const mockExport: AnkiExport = {
      id: "export-1",
      vocabularyId: "vocab-123",
      deckName: "English::B2",
      noteId: 1720000001,
      status: "success",
      exportedAt: "2026-09-20T10:05:00.000Z",
    };

    vi.spyOn(vocabularyRepository, "findLatestByWord").mockResolvedValue(mockEntry);
    vi.spyOn(vocabularyRepository, "getAnkiExportByVocabularyId").mockResolvedValue(mockExport);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await adapter.lookup("reconcile");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.fromDb).toBe(true);
    expect(result.word).toBe("reconcile");
    expect(result.isInAnki).toBe(true);
    expect(result.ankiNoteId).toBe(1720000001);
    expect(result.ankiDeckName).toBe("English::B2");
    expect(result.existingEntry?.id).toBe("vocab-123");
  });

  it("fetches remote dictionary when forceRemote is true even if word is in DB", async () => {
    const mockEntry: VocabularyEntry = {
      id: "vocab-123",
      word: "reconcile",
      normalizedWord: "reconcile",
      types: [{ name: "verb", patterns: [] }],
      pronunciations: [],
      audio: [],
      meanings: [{ id: "m-1", text: "Old meaning", source: "user" }],
      examples: [],
      status: "captured",
      createdAt: "2026-09-20T10:00:00.000Z",
      updatedAt: "2026-09-20T10:00:00.000Z",
      capture: {
        capturedAt: "2026-09-20T10:00:00.000Z",
        dateKey: "2026-09-20",
      },
    };

    vi.spyOn(vocabularyRepository, "findLatestByWord").mockResolvedValue(mockEntry);
    vi.spyOn(vocabularyRepository, "getAnkiExportByVocabularyId").mockResolvedValue(undefined);

    // Mock DictionaryAPI response
    const mockApiResponse = [
      {
        word: "reconcile",
        phonetics: [{ text: "/ˈrɛkənˌsaɪl/" }],
        meanings: [
          {
            partOfSpeech: "verb",
            definitions: [{ definition: "To restore friendly relations." }],
          },
        ],
      },
    ];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: unknown) => {
      const urlStr = String(url);
      if (urlStr.includes("dictionary.cambridge.org")) {
        return { ok: false, status: 403, text: async () => "" } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => mockApiResponse,
      } as unknown as Response;
    });

    const result = await adapter.lookup("reconcile", { forceRemote: true });

    expect(result.fromDb).toBeUndefined();
    expect(result.word).toBe("reconcile");
    expect(result.existingEntry?.id).toBe("vocab-123");
    expect(result.isInAnki).toBe(false);
    expect(result.meanings[0].text).toBe("To restore friendly relations.");
  });
});
