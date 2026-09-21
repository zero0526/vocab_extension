import { describe, expect, it } from "vitest";
import { CambridgeAdapter } from "./cambridge-adapter";

describe("DictionaryAPI Adapter", () => {
  const adapter = new CambridgeAdapter();

  it("parses Free Dictionary API payload into domain Vocabulary format", () => {
    const mockApiResponse = [
      {
        word: "try",
        phonetic: "/tɹaɪ/",
        phonetics: [
          {
            text: "/tɹaɪ/",
            audio: "https://api.dictionaryapi.dev/media/pronunciations/en/try-uk.mp3",
          },
          {
            text: "/tɹaɪ/",
            audio: "https://api.dictionaryapi.dev/media/pronunciations/en/try-us.mp3",
          },
        ],
        meanings: [
          {
            partOfSpeech: "verb",
            definitions: [
              {
                definition: "To attempt to do something.",
                example: "I tried to open the window.",
              },
            ],
          },
          {
            partOfSpeech: "noun",
            definitions: [
              {
                definition: "An attempt.",
                example: "Give it a try.",
              },
            ],
          },
        ],
      },
    ];

    const result = adapter.parseApiResponse(mockApiResponse[0], "try", "https://dictionary.cambridge.org/dictionary/english/try");

    expect(result.word).toBe("try");
    expect(result.types.map((t: { name: string }) => t.name)).toEqual(["verb", "noun"]);

    // Pronunciations
    expect(result.pronunciations.length).toBe(2);
    expect(result.pronunciations[0].dialect).toBe("UK");
    expect(result.pronunciations[0].variants[0].ipa).toBe("/tɹaɪ/");

    // Audio
    expect(result.audio.length).toBe(2);
    expect(result.audio[0].dialect).toBe("UK");
    expect(result.audio[0].url).toBe("https://api.dictionaryapi.dev/media/pronunciations/en/try-uk.mp3");
    expect(result.audio[1].dialect).toBe("US");
    expect(result.audio[1].url).toBe("https://api.dictionaryapi.dev/media/pronunciations/en/try-us.mp3");

    // Meanings & Examples
    expect(result.meanings.length).toBe(2);
    expect(result.meanings[0].text).toBe("To attempt to do something.");
    expect(result.examples.length).toBe(2);
    expect(result.examples[0].sentence).toBe("I tried to open the window.");
    expect(result.examples[1].sentence).toBe("Give it a try.");
  });
});
