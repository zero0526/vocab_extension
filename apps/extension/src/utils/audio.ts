import type { AudioResource } from "@vocab-extend/shared";

/**
 * Tải file audio từ URL và chuyển thành chuỗi Base64
 */
export async function downloadAudioAsBase64(
  url: string
): Promise<{ rawBase64: string; dataUrl: string }> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        // Tách chuỗi raw Base64 (bỏ phần data:audio/...;base64,) để gửi sang AnkiConnect
        const rawBase64 = dataUrl.split(",")[1] || "";
        resolve({ rawBase64, dataUrl });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn("Không thể tải file audio:", url, err);
    throw err;
  }
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
