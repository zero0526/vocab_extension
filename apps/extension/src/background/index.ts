import { setupContextMenus, handleContextMenuClick } from "./context-menu";

// Thiết lập declarativeNetRequest rules để fetch() từ extension không bị lộ origin chrome-extension://
function setupDeclarativeRules() {
  if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.updateDynamicRules) {
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1001],
      addRules: [
        {
          id: 1001,
          priority: 1,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders: [
              { header: "Referer", operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: "https://dictionary.cambridge.org/" },
              { header: "Origin", operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE },
            ],
          },
          condition: {
            urlFilter: "||dictionary.cambridge.org",
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
              chrome.declarativeNetRequest.ResourceType.OTHER,
            ],
          },
        },
      ],
    }).catch((e) => console.warn("Lỗi thiết lập declarativeNetRequest:", e));
  }
}

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenus();
  setupDeclarativeRules();
});

setupDeclarativeRules();


chrome.contextMenus.onClicked.addListener((info, tab) => {
  handleContextMenuClick(info, tab);
});

// Set side panel behavior to open on action click as well
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

// Handle internal extension messages
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "OPEN_DASHBOARD") {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/dashboard/index.html") });
    sendResponse({ success: true });
  }
  return true;
});

// Bắt trọn gói Header Cookie thật của trình duyệt khi tab gửi request tới Cambridge
if (chrome.webRequest && chrome.webRequest.onBeforeSendHeaders) {
  try {
    chrome.webRequest.onBeforeSendHeaders.addListener(
      (details) => {
        const cookieHeader = details.requestHeaders?.find(
          (h) => h.name.toLowerCase() === "cookie"
        );
        if (cookieHeader?.value) {
          const hasClearance = cookieHeader.value.includes("cf_clearance");
          chrome.storage.local.set({
            cambridgeCookieHeader: cookieHeader.value,
            hasCambridgeClearance: hasClearance,
            cambridgeCookieUpdatedAt: Date.now(),
          });
        }
      },
      { urls: ["*://*.cambridge.org/*"] },
      ["requestHeaders", "extraHeaders"]
    );
  } catch (err) {
    console.warn("Lỗi đăng ký webRequest listener:", err);
  }
}

