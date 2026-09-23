/**
 * Translation Service sử dụng Google Translate client=dict-chrome-ex
 * Chuyên dụng cho tiện ích mở rộng Chrome, không cần API Key, phản hồi siêu nhanh (~100ms)
 */

const translationCache = new Map<string, string>();

/**
 * Dịch một đoạn văn bản (định nghĩa, câu ví dụ, cụm từ) sang tiếng Việt
 */
export async function translateToVietnamese(
  text: string,
  sourceLang = "auto"
): Promise<string> {
  const clean = text.trim();
  if (!clean) return "";

  const cacheKey = `${sourceLang}_vi_${clean}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }

  const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${sourceLang}&tl=vi&q=${encodeURIComponent(
    clean
  )}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Google Translate HTTP ${res.status}`);
    }

    const data = await res.json();
    let translated = "";

    if (Array.isArray(data)) {
      if (typeof data[0] === "string") {
        translated = data[0];
      } else if (Array.isArray(data[0])) {
        // Trường hợp trả về mảng các câu [["câu 1", "en"], ["câu 2", "en"]]
        translated = data
          .map((item) => (Array.isArray(item) ? item[0] : String(item)))
          .filter(Boolean)
          .join(" ");
      }
    }

    if (translated) {
      translationCache.set(cacheKey, translated);
      return translated;
    }

    return "";
  } catch (error) {
    console.warn("Lỗi khi gọi Google Dịch:", error);
    return "";
  }
}

/**
 * Dịch song song một danh sách các đoạn văn bản
 */
export async function translateBatchToVietnamese(
  texts: string[],
  sourceLang = "auto"
): Promise<string[]> {
  return Promise.all(texts.map((t) => translateToVietnamese(t, sourceLang)));
}
