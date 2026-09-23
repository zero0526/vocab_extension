/**
 * Cambridge V8 Browser Tab Engine Fetcher
 * Cơ chế bypass Cloudflare Turnstile / Managed Challenge ("Just a moment...")
 * mà KHÔNG làm gián đoạn người dùng:
 *
 * 1. Ưu tiên 1: Tận dụng tab Cambridge sẵn có của người dùng (nếu có).
 *    Chạy Same-Origin fetch trực tiếp trong context của tab đó (siêu nhanh ~0.05s, không mở thêm tab nào).
 *
 * 2. Ưu tiên 2: Mở một background tab (active: false).
 *    - Không cướp tiêu điểm (active: false) nên người dùng vẫn tiếp tục đọc/gõ bình thường.
 *    - Trình duyệt Chrome chạy V8 giải Turnstile challenge trong tab thật.
 *    - Ngay khi phát hiện DOM từ điển xuất hiện, script bốc toàn bộ HTML về và TỰ ĐỘNG ĐÓNG tab ngay lập tức (~1-2s).
 *    - Đồng thời Chrome tự động lưu cookie cf_clearance, giúp các lần tra sau siêu mượt.
 */
export async function fetchCambridgeHtmlViaTab(url: string, timeoutMs = 12000): Promise<string> {
  if (typeof chrome === "undefined" || !chrome.tabs || !chrome.scripting) {
    throw new Error("Chrome Tabs & Scripting API không khả dụng trong môi trường này");
  }

  // --- Cách 1: Tận dụng tab Cambridge sẵn có trong trình duyệt ---
  try {
    const existingTabs = await chrome.tabs.query({ url: "*://*.cambridge.org/*" });
    const readyTab = existingTabs.find((t) => t.id && t.status === "complete");
    if (readyTab?.id) {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: readyTab.id },
        func: async (fetchUrl) => {
          try {
            const r = await fetch(fetchUrl, { credentials: "include" });
            if (!r.ok) return "";
            return await r.text();
          } catch {
            return "";
          }
        },
        args: [url],
      });

      if (
        res?.result &&
        (res.result.includes("headword") ||
          res.result.includes("pr dictionary") ||
          res.result.includes("entry-body") ||
          res.result.includes("pron-block"))
      ) {
        return res.result;
      }
    }
  } catch (e) {
    console.info("Không thể tận dụng tab Cambridge sẵn có, chuyển sang mở background tab:", e);
  }

  // --- Cách 2: Mở Background Tab chạy V8 engine giải Cloudflare ---
  return new Promise((resolve, reject) => {
    let createdTabId: number | undefined;
    let isResolved = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    const cleanup = () => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(timeoutTimer);
      if (pollTimer) clearInterval(pollTimer);

      if (chrome.tabs.onUpdated.hasListener(onUpdatedListener)) {
        chrome.tabs.onUpdated.removeListener(onUpdatedListener);
      }
      if (chrome.tabs.onRemoved.hasListener(onRemovedListener)) {
        chrome.tabs.onRemoved.removeListener(onRemovedListener);
      }

      if (createdTabId) {
        chrome.tabs.remove(createdTabId).catch(() => {});
      }
    };

    const timeoutTimer = setTimeout(() => {
      cleanup();
      reject(new Error("Timeout khi chờ Chrome giải Cloudflare Turnstile"));
    }, timeoutMs);

    const onRemovedListener = (tabId: number) => {
      if (tabId === createdTabId && !isResolved) {
        cleanup();
        reject(new Error("Tab Cambridge đã bị đóng trước khi hoàn tất"));
      }
    };

    const inspectTab = async () => {
      if (isResolved || !createdTabId) return;
      try {
        const [res] = await chrome.scripting.executeScript({
          target: { tabId: createdTabId },
          func: () => {
            const title = document.title || "";
            const html = document.documentElement?.outerHTML || "";
            const isChallenge =
              title.includes("Just a moment") ||
              html.includes("challenge-platform") ||
              html.includes("Enable JavaScript and cookies to continue");

            const isDictionary =
              html.includes("headword") ||
              html.includes("pr dictionary") ||
              html.includes("entry-body") ||
              html.includes("pron-block");

            return {
              html,
              title,
              isChallenge,
              isDictionary,
            };
          },
        });

        if (res?.result) {
          const { html, isChallenge, isDictionary } = res.result;
          if (!isChallenge && isDictionary) {
            cleanup();
            resolve(html);
          }
        }
      } catch {
        // Tab đang load hoặc chưa sẵn sàng DOM
      }
    };

    const onUpdatedListener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (tabId !== createdTabId || isResolved) return;
      if (changeInfo.status === "complete" || changeInfo.title) {
        inspectTab();
      }
    };

    chrome.tabs.onUpdated.addListener(onUpdatedListener);
    chrome.tabs.onRemoved.addListener(onRemovedListener);

    // Mở tab chạy ngầm (active: false - KHÔNG chuyển tab người dùng)
    chrome.tabs.create(
      {
        url,
        active: false,
      },
      (tab) => {
        if (!tab?.id) {
          cleanup();
          reject(new Error("Không thể tạo background tab"));
          return;
        }
        createdTabId = tab.id;
        // Bắt đầu poll kiểm tra định kỳ mỗi 400ms để bắt ngay khi DOM sẵn sàng
        pollTimer = setInterval(inspectTab, 400);
      }
    );
  });
}

/**
 * Tải file audio từ Cambridge thông qua context tab thật của trình duyệt để vượt qua Cloudflare
 * và chính sách Cross-Origin-Resource-Policy: same-origin
 */
export async function fetchCambridgeAudioViaTab(
  audioUrl: string,
  timeoutMs = 12000
): Promise<string> {
  if (typeof chrome === "undefined" || !chrome.tabs || !chrome.scripting) {
    throw new Error("Chrome Tabs & Scripting API không khả dụng");
  }

  // 1. Ưu tiên 1: Tận dụng tab Cambridge sẵn có của người dùng
  try {
    const existingTabs = await chrome.tabs.query({ url: "*://*.cambridge.org/*" });
    const readyTab = existingTabs.find((t) => t.id && t.status === "complete");
    if (readyTab?.id) {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: readyTab.id },
        func: async (fetchUrl) => {
          try {
            const r = await fetch(fetchUrl, { credentials: "include" });
            if (!r.ok) return null;
            const blob = await r.blob();
            if (blob.type.includes("html") || blob.size < 500) return null;
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } catch {
            return null;
          }
        },
        args: [audioUrl],
      });

      if (res?.result && typeof res.result === "string" && res.result.startsWith("data:audio")) {
        return res.result;
      }
    }
  } catch (e) {
    console.info("Không thể tải audio qua tab Cambridge sẵn có:", e);
  }

  // 2. Ưu tiên 2: Mở background tab ngắn hạn (active: false)
  return new Promise((resolve, reject) => {
    let createdTabId: number | undefined;
    let isResolved = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    const cleanup = () => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(timeoutTimer);
      if (pollTimer) clearInterval(pollTimer);

      if (chrome.tabs.onUpdated.hasListener(onUpdatedListener)) {
        chrome.tabs.onUpdated.removeListener(onUpdatedListener);
      }
      if (chrome.tabs.onRemoved.hasListener(onRemovedListener)) {
        chrome.tabs.onRemoved.removeListener(onRemovedListener);
      }

      if (createdTabId) {
        chrome.tabs.remove(createdTabId).catch(() => {});
      }
    };

    const timeoutTimer = setTimeout(() => {
      cleanup();
      reject(new Error("Timeout khi chờ tải audio qua Cambridge tab"));
    }, timeoutMs);

    const onRemovedListener = (tabId: number) => {
      if (tabId === createdTabId && !isResolved) {
        cleanup();
        reject(new Error("Tab Cambridge đã đóng trước khi tải xong audio"));
      }
    };

    const tryDownloadInTab = async () => {
      if (isResolved || !createdTabId) return;
      try {
        const [res] = await chrome.scripting.executeScript({
          target: { tabId: createdTabId },
          func: async (fetchUrl) => {
            const title = document.title || "";
            if (title.includes("Just a moment")) return "CHALLENGE";
            try {
              const r = await fetch(fetchUrl, { credentials: "include" });
              if (!r.ok) return null;
              const blob = await r.blob();
              if (blob.type.includes("html") || blob.size < 500) return null;
              return new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
            } catch {
              return null;
            }
          },
          args: [audioUrl],
        });

        if (res?.result && typeof res.result === "string" && res.result.startsWith("data:audio")) {
          const dataUrl = res.result;
          cleanup();
          resolve(dataUrl);
        }
      } catch {
        // Tab not ready yet
      }
    };

    const onUpdatedListener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (tabId !== createdTabId || isResolved) return;
      if (changeInfo.status === "complete") {
        tryDownloadInTab();
      }
    };

    chrome.tabs.onUpdated.addListener(onUpdatedListener);
    chrome.tabs.onRemoved.addListener(onRemovedListener);

    chrome.tabs.create(
      {
        url: "https://dictionary.cambridge.org/dictionary/english/try",
        active: false,
      },
      (tab) => {
        if (!tab?.id) {
          cleanup();
          reject(new Error("Không thể tạo background tab"));
          return;
        }
        createdTabId = tab.id;
        pollTimer = setInterval(tryDownloadInTab, 500);
      }
    );
  });
}

