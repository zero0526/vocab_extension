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
   */
  async getClearanceCookie(): Promise<chrome.cookies.Cookie | null> {
    if (typeof chrome === "undefined" || !chrome.cookies) {
      return null;
    }

    try {
      const cookie = await chrome.cookies.get({
        url: CAMBRIDGE_URL,
        name: "cf_clearance",
      });
      return cookie || null;
    } catch (e) {
      console.warn("Lỗi khi đọc cookie từ Chrome:", e);
      return null;
    }
  }

  /**
   * Kiểm tra xem cookie cf_clearance có tồn tại và còn hạn không
   */
  async hasValidToken(): Promise<boolean> {
    const cookie = await this.getClearanceCookie();
    if (!cookie) return false;

    // Kiểm tra hạn sử dụng nếu có
    if (cookie.expirationDate) {
      const nowInSeconds = Date.now() / 1000;
      if (cookie.expirationDate < nowInSeconds) {
        return false;
      }
    }
    return true;
  }

  /**
   * Lấy toàn bộ cookie của Cambridge dưới dạng chuỗi Header (Cookie: name=val; ...)
   */
  async getCookieHeader(): Promise<string> {
    if (typeof chrome === "undefined" || !chrome.cookies) {
      return "";
    }

    try {
      const cookies = await chrome.cookies.getAll({ domain: "cambridge.org" });
      return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    } catch {
      return "";
    }
  }

  /**
   * Tự động mở một tab Cambridge để trình duyệt giải captcha Cloudflare
   * và đóng tab ngay khi nhận được cookie cf_clearance mới.
   */
  async acquireTokenInteractive(): Promise<boolean> {
    if (typeof chrome === "undefined" || !chrome.tabs || !chrome.cookies) {
      return false;
    }

    return new Promise((resolve) => {
      let resolved = false;
      let createdTabId: number | undefined;

      // 1. Lắng nghe sự kiện sinh cookie cf_clearance mới
      const cookieListener = (changeInfo: chrome.cookies.CookieChangeInfo) => {
        if (
          !changeInfo.removed &&
          changeInfo.cookie.name === "cf_clearance" &&
          changeInfo.cookie.domain.includes("cambridge.org")
        ) {
          cleanup(true);
        }
      };

      chrome.cookies.onChanged.addListener(cookieListener);

      // 2. Mở tab để Chrome giải challenge
      chrome.tabs.create(
        {
          url: `${CAMBRIDGE_URL}/dictionary/english/try`,
          active: true,
        },
        (tab) => {
          createdTabId = tab.id;
        }
      );

      // 3. Timeout an toàn sau 30 giây
      const timeoutTimer = setTimeout(() => {
        cleanup(false);
      }, 30000);

      function cleanup(success: boolean) {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutTimer);
        chrome.cookies.onChanged.removeListener(cookieListener);

        // Tự động đóng tab nếu đã lấy được token thành công
        if (createdTabId) {
          chrome.tabs.remove(createdTabId).catch(() => {});
        }
        resolve(success);
      }
    });
  }
}

export const cambridgeAuth = new CambridgeAuthManager();
