import type { AudioResource } from "@vocab-extend/shared";
import { fetchCambridgeAudioViaTab } from "../services/dictionary/cambridge-tab-fetcher";

async function blobToDataUrl(blob: Blob): Promise<string> {
  if (typeof FileReader !== "undefined") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  const buffer = await blob.arrayBuffer();
  const base64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(buffer).toString("base64")
      : btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return `data:${blob.type || "audio/mp3"};base64,${base64}`;
}

/**
 * Kiểm tra xem chuỗi rawBase64 có phải là HTML challenge của Cloudflare hay không
 */
function isHtmlChallenge(rawBase64: string): boolean {
  if (!rawBase64) return true;
  // Các prefix Base64 phổ biến của '<!DOCTYPE', '<html', '<head'
  return (
    rawBase64.startsWith("PCFET0NU") || // '<!DOCT'
    rawBase64.startsWith("PGh0bW") ||   // '<html'
    rawBase64.startsWith("PGhlYW")      // '<head'
  );
}

/**
 * Tải file audio từ URL và chuyển thành chuỗi Base64
 * Cơ chế 3 tầng vượt qua Cloudflare & CORP:
 * 1. Fetch trực tiếp kèm credentials (kho cookie trình duyệt)
 * 2. V8 Tab Engine trong origin Cambridge (bỏ qua triệt để CORP và bot detection)
 * 3. Fallback sang Google TTS cho từ vựng tương ứng nếu link Cambridge bị lỗi
 */
export async function downloadAudioAsBase64(
  url: string,
  fallbackWord?: string,
  dialect?: string
): Promise<{ rawBase64: string; dataUrl: string }> {
  // 1. Thử fetch trực tiếp kèm credentials
  try {
    const res = await fetch(url, { credentials: "include" });
    if (res.ok) {
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("html")) {
        const blob = await res.blob();
        if (!blob.type.includes("html") && blob.size > 500) {
          const dataUrl = await blobToDataUrl(blob);
          const rawBase64 = dataUrl.split(",")[1] || "";
          if (!isHtmlChallenge(rawBase64)) {
            return { rawBase64, dataUrl };
          }
        }
      }
    }
  } catch (err) {
    console.info("Direct audio fetch không thành công:", err);
  }

  // 2. Nếu là URL Cambridge và bị chặn -> V8 Tab Engine
  if (url.includes("cambridge.org") && typeof chrome !== "undefined" && chrome.tabs && chrome.scripting) {
    try {
      const dataUrl = await fetchCambridgeAudioViaTab(url);
      if (dataUrl && dataUrl.startsWith("data:audio")) {
        const rawBase64 = dataUrl.split(",")[1] || "";
        if (!isHtmlChallenge(rawBase64)) {
          return { rawBase64, dataUrl };
        }
      }
    } catch (tabErr) {
      console.warn("Không thể tải audio qua Cambridge tab:", tabErr);
    }
  }

  // 3. Fallback sang Google TTS
  if (fallbackWord) {
    try {
      const isUk = (dialect || "").toUpperCase() === "UK";
      const langCode = isUk ? "en-UK" : "en-US";
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encodeURIComponent(
        fallbackWord
      )}`;
      const ttsRes = await fetch(ttsUrl);
      if (ttsRes.ok) {
        const blob = await ttsRes.blob();
        const dataUrl = await blobToDataUrl(blob);
        const rawBase64 = dataUrl.split(",")[1] || "";
        if (!isHtmlChallenge(rawBase64)) {
          return { rawBase64, dataUrl };
        }
      }
    } catch (ttsErr) {
      console.warn("Lỗi tải fallback audio từ Google TTS:", ttsErr);
    }
  }

  throw new Error(`Không thể tải file audio cho ${url} (bị Cloudflare chặn và không có fallback)`);
}

/**
 * Phát âm thanh từ AudioResource (ưu tiên file đã tải về trong Cache, fallback URL)
 */
export function playAudioResource(resource: AudioResource): void {
  try {
    let src = "";
    if (resource.base64) {
      src = resource.base64.startsWith("data:")
        ? resource.base64
        : `data:audio/mp3;base64,${resource.base64}`;
    } else if (resource.url) {
      src = resource.url;
    }

    if (!src) return;

    const audio = new Audio(src);
    audio.play().catch((err) => {
      console.warn("Lỗi phát audio:", err);
    });
  } catch (e) {
    console.warn("Lỗi khởi tạo Audio:", e);
  }
}
