import { describe, expect, it } from "vitest";
import { vocabularyFormSchema } from "./vocabulary.schema";

describe("vocabularyFormSchema validation", () => {
  it("rejects empty word", () => {
    const res = vocabularyFormSchema.safeParse({
      word: "   ",
      types: [],
      pronunciations: [],
      audio: [],
      meanings: [{ id: "m1", text: "nghĩa", source: "user" }],
      examples: [],
      capture: {
        capturedAt: new Date().toISOString(),
        dateKey: "2026-09-22",
      },
    });
    expect(res.success).toBe(false);
  });

  it("requires at least one meaning", () => {
    const res = vocabularyFormSchema.safeParse({
      word: "reconcile",
      types: [],
      pronunciations: [],
      audio: [],
      meanings: [],
      examples: [],
      capture: {
        capturedAt: new Date().toISOString(),
        dateKey: "2026-09-22",
      },
    });
    expect(res.success).toBe(false);
  });

  it("accepts valid vocabulary form data", () => {
    const res = vocabularyFormSchema.safeParse({
      word: "reconcile",
      types: [{ name: "verb", patterns: [] }],
      pronunciations: [
        {
          dialect: "UK",
          variants: [{ type: "standard", ipa: "/ˈrek.ən.saɪl/" }],
        },
      ],
      audio: [],
      meanings: [
        {
          id: "1",
          text: "Đồng bộ trạng thái thực tế và mong muốn",
          context: "Kubernetes",
          source: "user",
        },
      ],
      examples: [
        {
          id: "ex1",
          sentence: "The controller reconciles the desired state.",
          source: "Kubernetes Docs",
          sourceType: "document",
        },
      ],
      memory: "Đưa hai trạng thái về khớp nhau",
      capture: {
        sourceUrl: "https://kubernetes.io",
        sourceTitle: "K8s Docs",
        selectedText: "reconcile",
        capturedAt: new Date().toISOString(),
        dateKey: "2026-09-22",
      },
    });
    expect(res.success).toBe(true);
  });
});
