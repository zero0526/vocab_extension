// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { parseCambridgeHtml, cleanIpa, resolveAudioUrl } from "./cambridge-parser";

describe("Cambridge Parser", () => {
  it("cleans IPA text correctly", () => {
    expect(cleanIpa("US /traɪ/")).toBe("/traɪ/");
    expect(cleanIpa("UK /ˈrek.ən.saɪl/")).toBe("/ˈrek.ən.saɪl/");
    expect(cleanIpa("traɪ")).toBe("/traɪ/");
    expect(cleanIpa("")).toBe("");
  });

  it("resolves audio URLs with base URL", () => {
    expect(resolveAudioUrl("/media/english/uk_pron/uktra__001.mp3")).toBe(
      "https://dictionary.cambridge.org/media/english/uk_pron/uktra__001.mp3"
    );
    expect(
      resolveAudioUrl("https://dictionary.cambridge.org/media/english/us_pron/ustry__001.mp3")
    ).toBe("https://dictionary.cambridge.org/media/english/us_pron/ustry__001.mp3");
    expect(resolveAudioUrl(null)).toBeUndefined();
  });

  it("parses Cambridge HTML with .pr.dictionary, .pron-block, data-src-mp3 and .def-block", () => {
    const mockHtml = `
      <html>
        <body>
          <h2 class="headword"><span class="hw">try</span></h2>
          
          <div class="pr dictionary">
            <span class="pos">verb</span>
            <div class="pron-block">
              <span class="region">UK</span>
              <span class="ipa">/traɪ/</span>
              <audio data-src-mp3="/media/english/uk_pron/uktry001.mp3"></audio>
            </div>
            <div class="pron-block">
              <span class="region">US</span>
              <span class="ipa">/traɪ/</span>
              <audio data-src-mp3="/media/english/us_pron/ustry001.mp3"></audio>
            </div>

            <div class="def-block">
              <span class="def">to attempt to do something:</span>
              <div class="examp">
                <span class="eg">I tried to open the window.</span>
              </div>
            </div>
          </div>

          <div class="pr dictionary">
            <span class="pos">noun</span>
            <div class="def-block">
              <span class="def">an attempt to do something:</span>
              <div class="examp">
                <span class="eg">Give it a try.</span>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const result = parseCambridgeHtml(mockHtml, "try");

    expect(result.word).toBe("try");
    expect(result.types.map((t) => t.name)).toEqual(["verb", "noun"]);

    // Pronunciations
    const ukPron = result.pronunciations.find((p) => p.dialect === "UK");
    const usPron = result.pronunciations.find((p) => p.dialect === "US");
    expect(ukPron?.variants[0].ipa).toBe("/traɪ/");
    expect(usPron?.variants[0].ipa).toBe("/traɪ/");

    // Audio extracted from data-src-mp3
    const ukAudio = result.audio.find((a) => a.dialect === "UK");
    const usAudio = result.audio.find((a) => a.dialect === "US");
    expect(ukAudio?.url).toBe("https://dictionary.cambridge.org/media/english/uk_pron/uktry001.mp3");
    expect(usAudio?.url).toBe("https://dictionary.cambridge.org/media/english/us_pron/ustry001.mp3");

    // Meanings & Examples
    expect(result.meanings.length).toBe(2);
    expect(result.meanings[0].text).toBe("to attempt to do something");
    expect(result.examples.length).toBe(2);
    expect(result.examples[0].sentence).toBe("I tried to open the window.");
    expect(result.examples[1].sentence).toBe("Give it a try.");
  });
});
