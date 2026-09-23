import { describe, expect, it, vi, beforeEach } from "vitest";
import { AnkiClient } from "./anki-client";
import { db } from "../../db/database";
import type { VocabularyEntry } from "@vocab-extend/shared";

describe("AnkiClient.updateNote", () => {
  const client = new AnkiClient();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls updateNoteFields with formatted note fields and updates DB status", async () => {
    const mockEntry: VocabularyEntry = {
      id: "vocab-456",
      word: "persevere",
      normalizedWord: "persevere",
      types: [{ name: "verb", patterns: [] }],
      pronunciations: [{ dialect: "UK", variants: [{ ipa: "/ˌpɜː.sɪˈvɪər/" }] }],
      audio: [],
      meanings: [{ id: "m-1", text: "Tiếp tục kiên trì", source: "user" }],
      examples: [{ id: "e-1", sentence: "She persevered in her studies.", sourceType: "user" }],
      status: "enriched",
      createdAt: "2026-09-21T10:00:00.000Z",
      updatedAt: "2026-09-21T10:00:00.000Z",
      capture: {
        capturedAt: "2026-09-21T10:00:00.000Z",
        dateKey: "2026-09-21",
      },
    };

    // Mock invoke calls:
    // 1. notesInfo
    // 2. modelFieldNames
    // 3. updateNoteFields
    const invokedActions: Array<{ action: string; params: Record<string, unknown> }> = [];
    vi.spyOn(client as unknown as { invoke: (action: string, params: Record<string, unknown>) => Promise<unknown> }, "invoke")
      .mockImplementation(async (action: string, params: Record<string, unknown> = {}) => {
        invokedActions.push({ action, params });
        if (action === "notesInfo") {
          return [{ noteId: 999123, modelName: "Basic" }];
        }
        if (action === "modelFieldNames") {
          return ["Front", "Back"];
        }
        if (action === "updateNoteFields") {
          return null;
        }
        return null;
      });

    vi.spyOn(db.ankiExports, "where").mockReturnValue({
      equals: () => ({
        first: async () => ({ id: "export-99", vocabularyId: "vocab-456", noteId: 999123 }),
      }),
    } as unknown as ReturnType<typeof db.ankiExports.where>);
    vi.spyOn(db.ankiExports, "update").mockResolvedValue(1);
    vi.spyOn(db.vocabulary, "update").mockResolvedValue(1);

    await client.updateNote(999123, mockEntry);

    const updateCall = invokedActions.find((a) => a.action === "updateNoteFields");
    expect(updateCall).toBeDefined();
    const noteParam = updateCall?.params.note as { id: number; fields: Record<string, string> };
    expect(noteParam.id).toBe(999123);
    expect(noteParam.fields.Front).toBe("persevere");
    expect(noteParam.fields.Back).toContain("Tiếp tục kiên trì");
    expect(db.vocabulary.update).toHaveBeenCalledWith("vocab-456", expect.objectContaining({ status: "exported" }));
  });
});
