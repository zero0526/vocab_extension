import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  formatWordTypesHtml,
  formatPronunciationsHtml,
  formatMeaningsHtml,
  formatExamplesHtml,
  formatMemoryHtml,
  buildCardHtml,
} from "./anki-card-formatter";
import type { VocabularyEntry } from "@vocab-extend/shared";

describe("anki-card-formatter", () => {
  it("escapes special HTML characters correctly", () => {
    expect(escapeHtml("Tom & Jerry <cat> 'mouse' \"cheese\"")).toBe(
      "Tom &amp; Jerry &lt;cat&gt; &#039;mouse&#039; &quot;cheese&quot;"
    );
  });

  it("formats word types as badges", () => {
    const html = formatWordTypesHtml([{ name: "verb", patterns: [] }, { name: "noun", patterns: [] }]);
    expect(html).toContain("vocab-badge-pos");
    expect(html).toContain("VERB");
    expect(html).toContain("NOUN");
  });

  it("formats UK and US pronunciations with flags and IPA tags", () => {
    const html = formatPronunciationsHtml(
      [
        { dialect: "UK", variants: [{ ipa: "/həˈləʊ/" }] },
        { dialect: "US", variants: [{ ipa: "/həˈloʊ/" }] },
      ],
      ["[sound:vocab_hello_uk.mp3]"]
    );
    expect(html).toContain("🇬🇧 UK");
    expect(html).toContain("🇺🇸 US");
    expect(html).toContain("/həˈləʊ/");
    expect(html).toContain("[sound:vocab_hello_uk.mp3]");
  });

  it("formats meanings with circular number badges, context, and Vietnamese translation", () => {
    const html = formatMeaningsHtml([
      {
        id: "1",
        text: "used when meeting someone",
        context: "greeting",
        source: "dictionary",
        translation: "dùng khi gặp ai đó",
      },
      { id: "2", text: "an expression of surprise", source: "dictionary" },
    ]);
    expect(html).toContain("vocab-meaning-index");
    expect(html).toContain("used when meeting someone");
    expect(html).toContain("greeting");
    expect(html).toContain("vocab-meaning-vi");
    expect(html).toContain("🇻🇳 dùng khi gặp ai đó");
    expect(html).toContain("an expression of surprise");
  });

  it("formats examples with quote block styling", () => {
    const html = formatExamplesHtml([
      { id: "e1", sentence: "Hello, nice to meet you!", source: "Cambridge Dictionary", sourceType: "dictionary" },
    ]);
    expect(html).toContain("vocab-example-card");
    expect(html).toContain("Hello, nice to meet you!");
    expect(html).toContain("Cambridge Dictionary");
  });

  it("formats memory tip with amber callout card", () => {
    const html = formatMemoryHtml("Nhớ từ hello bằng cách chào buổi sáng");
    expect(html).toContain("vocab-memory-card");
    expect(html).toContain("Mẹo ghi nhớ");
    expect(html).toContain("Nhớ từ hello bằng cách chào buổi sáng");
  });

  it("builds a complete responsive HTML card with dark mode styling", () => {
    const mockEntry: VocabularyEntry = {
      id: "v-1",
      word: "persevere",
      normalizedWord: "persevere",
      types: [{ name: "verb", patterns: [] }],
      pronunciations: [{ dialect: "UK", variants: [{ ipa: "/ˌpɜː.sɪˈvɪər/" }] }],
      audio: [],
      meanings: [{ id: "m-1", text: "Tiếp tục kiên trì", context: "formal", source: "dictionary" }],
      examples: [{ id: "e-1", sentence: "She persevered in her studies.", source: "Cambridge", sourceType: "dictionary" }],
      memory: "per (qua) + severe (nghiêm trọng) -> vượt qua gian khó",
      status: "enriched",
      createdAt: "2026-09-21T10:00:00.000Z",
      updatedAt: "2026-09-21T10:00:00.000Z",
      capture: {
        capturedAt: "2026-09-21T10:00:00.000Z",
        dateKey: "2026-09-21",
        sourceTitle: "Article Title",
      },
    };

    const cardHtml = buildCardHtml(mockEntry, ["[sound:vocab_persevere_uk.mp3]"]);

    expect(cardHtml).toContain("<style>");
    expect(cardHtml).toContain(".vocab-anki-card");
    expect(cardHtml).toContain("persevere");
    expect(cardHtml).toContain("VERB");
    expect(cardHtml).toContain("🇬🇧 UK");
    expect(cardHtml).toContain("Tiếp tục kiên trì");
    expect(cardHtml).toContain("formal");
    expect(cardHtml).toContain("She persevered in her studies.");
    expect(cardHtml).toContain("Mẹo ghi nhớ");
    expect(cardHtml).toContain("nightMode");
    expect(cardHtml).toContain("[sound:vocab_persevere_uk.mp3]");
  });
});
