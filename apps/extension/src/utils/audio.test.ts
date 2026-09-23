import { describe, expect, it, vi, beforeEach } from "vitest";
import { downloadAudioAsBase64, playAudioResource } from "./audio";

describe("audio utils", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("plays audio from base64 resource", () => {
    const playMock = vi.fn().mockResolvedValue(undefined);
    class MockAudio {
      src: string;
      play = playMock;
      constructor(src: string) {
        this.src = src;
      }
    }
    vi.stubGlobal("Audio", MockAudio);

    playAudioResource({
      url: "https://example.com/audio.mp3",
      base64: "AAAA",
      dialect: "UK",
    });

    expect(playMock).toHaveBeenCalled();
  });

  it("rejects HTML challenge responses and falls back to Google TTS", async () => {
    // Giả lập:
    // 1. Fetch tới link Cambridge trả về HTML Cloudflare Challenge (text/html)
    // 2. Fetch tới link Google TTS trả về audio/mpeg thật
    const htmlResponse = new Response("<!DOCTYPE html><html><title>Just a moment...</title></html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });

    const realAudioResponse = new Response(new Uint8Array([0xff, 0xfb, 0x90, 0x44, 0x00, 0x11, 0x22]), {
      status: 200,
      headers: { "Content-Type": "audio/mpeg" },
    });

    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("cambridge.org")) {
        return htmlResponse.clone();
      }
      if (url.includes("translate.google.com")) {
        return realAudioResponse.clone();
      }
      return new Response("", { status: 404 });
    });

    const result = await downloadAudioAsBase64(
      "https://dictionary.cambridge.org/media/english/uk_pron/u/ukm/ukmam/ukmammo006.mp3",
      "mammoth",
      "UK"
    );

    expect(result).toBeDefined();
    expect(result.rawBase64).toBeDefined();
    // Đảm bảo không phải là HTML challenge
    expect(result.rawBase64).not.toContain("PCFET0NU");
  });
});
