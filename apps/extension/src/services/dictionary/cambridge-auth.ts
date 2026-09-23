/**
 * Cambridge Dictionary Cloudflare Token & Cookie Manager
 * Tận dụng cookie 'cf_clearance' từ trình duyệt để vượt qua Cloudflare challenge
 */

const CAMBRIDGE_URL = "https://dictionary.cambridge.org";

export interface CookieInfo {
  name: string;
  value: string;
  domain?: string;
  expirationDate?: number;
}

export class CambridgeAuthManager {
  /**
   * Lấy cookie cf_clearance từ kho cookie của Chrome
   * Hỗ trợ tìm kiếm đa tầng: URL chính xác, domain .cambridge.org, và wildcard name
   */
  async getClearanceCookie(): Promise<chrome.cookies.Cookie | null> {
    if (typeof chrome === "undefined" || !chrome.cookies) {
      return null;
    }

    try {
      // 1. Thử lấy trực tiếp theo URL
      const cookieByUrl = await chrome.cookies.get({
        url: CAMBRIDGE_URL,
        name: "cf_clearance",
      });
      if (cookieByUrl) return cookieByUrl;

      // 2. Thử tìm trên toàn bộ domain cambridge.org (Cloudflare thường set cookie trên .cambridge.org)
      const allDomainCookies = await chrome.cookies.getAll({ domain: "cambridge.org" });
      const cfCookie = allDomainCookies.find((c) => c.name === "cf_clearance");
      if (cfCookie) return cfCookie;

      // 3. Fallback: Tìm trên dictionary.cambridge.org
      const dictDomainCookies = await chrome.cookies.getAll({ domain: "dictionary.cambridge.org" });
      const dictCfCookie = dictDomainCookies.find((c) => c.name === "cf_clearance");
      if (dictCfCookie) return dictCfCookie;

      // 4. Quét toàn bộ cookie có tên cf_clearance
      const allCf = await chrome.cookies.getAll({ name: "cf_clearance" });
      return allCf.find((c) => c.domain.includes("cambridge.org")) || null;
    } catch (e) {
      console.warn("Lỗi khi đọc cookie từ Chrome:", e);
      return null;
    }
  }

  async hasValidToken(): Promise<boolean> {
    if (typeof chrome === "undefined") {
      return false;
    }

    // 1. Kiểm tra qua cookie API của Chrome
    if (chrome.cookies) {
      try {
        const cookie = await this.getClearanceCookie();
        if (cookie) {
          if (!cookie.expirationDate || cookie.expirationDate > Date.now() / 1000) {
            return true;
          }
        }

        // Bất kỳ cookie nào của domain cambridge.org
        const cambridgeCookies = await chrome.cookies.getAll({ domain: "cambridge.org" });
        if (cambridgeCookies && cambridgeCookies.length > 0) {
          return true;
        }
      } catch (e) {
        console.warn("Lỗi kiểm tra cookie:", e);
      }
    }

    // 2. Kiểm tra qua Cookie Header bắt được từ webRequest của tab thật
    if (chrome.storage?.local) {
      try {
        const res = await chrome.storage.local.get(["hasCambridgeClearance", "cambridgeCookieHeader", "cambridgeCookieUpdatedAt"]);
        if (res.hasCambridgeClearance || res.cambridgeCookieHeader) {
          const age = Date.now() - (res.cambridgeCookieUpdatedAt || 0);
          if (age < 24 * 60 * 60 * 1000) {
            return true;
          }
        }
      } catch {}
    }

    return false;
  }

  /**
   * Lấy toàn bộ cookie của Cambridge dưới dạng chuỗi Header (Cookie: name=val; ...)
   */
  async getCookieHeader(): Promise<string> {
    if (typeof chrome === "undefined") {
      return "";
    }

    // 1. Ưu tiên lấy chuỗi Cookie Header gốc 100% bắt được trực tiếp từ tab trình duyệt
    if (chrome.storage?.local) {
      try {
        const res = await chrome.storage.local.get(["cambridgeCookieHeader"]);
        if (res.cambridgeCookieHeader) {
          return res.cambridgeCookieHeader;
        }
      } catch {}
    }

    // 2. Fallback: Lấy qua chrome.cookies API
    if (chrome.cookies) {
      try {
        const cookies = await chrome.cookies.getAll({ domain: "cambridge.org" });
        return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
      } catch {
        return "";
      }
    }

    return "";
  }


  /**
   * Tự động mở một tab Cambridge để trình duyệt giải captcha Cloudflare
   * và đóng tab ngay khi nhận được cookie cf_clearance mới.
   */
  async acquireTokenInteractive(): Promise<boolean> {
    if (typeof chrome === "undefined" || !chrome.tabs || !chrome.cookies) {
      return false;
    }

    // 0. Nếu token đã có sẵn trong trình duyệt và còn hạn -> Hoàn tất ngay lập tức
    if (await this.hasValidToken()) {
      return true;
    }

    return new Promise((resolve) => {
      let resolved = false;
      let createdTabId: number | undefined;
      let pollInterval: ReturnType<typeof setInterval> | undefined;

      const cleanup = (success: boolean) => {
        if (resolved) return;
        resolved = true;
        if (pollInterval) clearInterval(pollInterval);
        clearTimeout(timeoutTimer);
        chrome.cookies.onChanged.removeListener(cookieListener);

        // Tự động đóng tab nếu đã lấy được token thành công
        if (createdTabId) {
          chrome.tabs.remove(createdTabId).catch(() => {});
        }
        resolve(success);
      };

      // 1. Lắng nghe sự kiện sinh cookie Cambridge hoặc cf_clearance mới
      const cookieListener = (changeInfo: chrome.cookies.CookieChangeInfo) => {
        if (
          !changeInfo.removed &&
          (changeInfo.cookie.name === "cf_clearance" ||
            changeInfo.cookie.domain.includes("cambridge.org"))
        ) {
          cleanup(true);
        }
      };

      chrome.cookies.onChanged.addListener(cookieListener);

      // 2. Poll định kỳ mỗi 500ms để bắt ngay khi cookie được ghi vào kho
      pollInterval = setInterval(async () => {
        const hasToken = await this.hasValidToken();
        if (hasToken) {
          cleanup(true);
        }
      }, 500);

      // 3. Mở tab ngầm để Chrome nạp cookie và giải challenge
      chrome.tabs.create(
        {
          url: `${CAMBRIDGE_URL}/dictionary/english/try`,
          active: false,
        },
        (tab) => {
          createdTabId = tab?.id;
        }
      );

      // 4. Timeout an toàn sau 30 giây
      const timeoutTimer = setTimeout(() => {
        cleanup(false);
      }, 30000);
    });
  }
}


export const cambridgeAuth = new CambridgeAuthManager();
