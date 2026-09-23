import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  translateToVietnamese,
  translateBatchToVietnamese,
} from "./translate.service";

describe("translate.service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty string for empty or whitespace-only input", async () => {
    const res = await translateToVietnamese("   ");
    expect(res).toBe("");
  });

  it("translates text using nested array response from Google Translate", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [["nỗ lực làm điều gì đó", "en"]],
    } as Response);

    const result = await translateToVietnamese("to make an effort uniquely-1");
    expect(result).toBe("nỗ lực làm điều gì đó");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(String((globalThis.fetch as any).mock.calls[0][0])).toContain(
      "clients5.google.com/translate_a/t"
    );
  });

  it("handles flat array response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ["bản dịch phẳng"],
    } as Response);

    const result = await translateToVietnamese("flat translation test uniquely-2");
    expect(result).toBe("bản dịch phẳng");
  });

  it("uses memory cache for subsequent calls with same text", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [["thử nghiệm bộ nhớ đệm", "en"]],
    } as Response);

    const text = "cache test string uniquely-3";
    const res1 = await translateToVietnamese(text);
    const res2 = await translateToVietnamese(text);

    expect(res1).toBe("thử nghiệm bộ nhớ đệm");
    expect(res2).toBe("thử nghiệm bộ nhớ đệm");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("returns empty string on network failure without throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network connection error")
    );

    const result = await translateToVietnamese("fail test uniquely-4");
    expect(result).toBe("");
  });

  it("translates batch of strings in parallel", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [["nghĩa 1", "en"]],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [["nghĩa 2", "en"]],
      } as Response);

    const results = await translateBatchToVietnamese([
      "meaning 1 uniquely-5",
      "meaning 2 uniquely-6",
    ]);

    expect(results).toEqual(["nghĩa 1", "nghĩa 2"]);
  });
});
