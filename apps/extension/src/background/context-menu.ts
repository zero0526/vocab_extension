export function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "vocab-extend-capture",
      title: "Tra từ '%s' & Lưu vào VocabExtend",
      contexts: ["selection"],
    });
  });
}

export function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
) {
  if (info.menuItemId !== "vocab-extend-capture") return;

  const selectedText = info.selectionText?.trim();
  if (!selectedText || !tab) return;

  // 1. MUST open Side Panel SYNCHRONOUSLY to preserve user gesture context in Chrome MV3
  if (chrome.sidePanel && chrome.sidePanel.open) {
    const openOptions = tab.windowId
      ? { windowId: tab.windowId }
      : tab.id
      ? { tabId: tab.id }
      : undefined;

    if (openOptions) {
      chrome.sidePanel.open(openOptions).catch((err) => {
        console.warn("Lỗi mở sidePanel:", err);
      });
    }
  }

  const capturePayload = {
    word: selectedText,
    sourceUrl: tab.url || "",
    sourceTitle: tab.title || "",
    capturedAt: new Date().toISOString(),
  };

  // 2. Save to chrome.storage.local asynchronously
  chrome.storage.local
    .set({ pendingCapture: capturePayload })
    .then(() => {
      // 3. Notify any already-open Side Panel
      chrome.runtime
        .sendMessage({
          type: "NEW_SELECTION_CAPTURE",
          payload: capturePayload,
        })
        .catch(() => {
          // Side panel might not be open yet, it will read pendingCapture from storage on mount
        });
    })
    .catch((err) => {
      console.warn("Lỗi lưu pendingCapture:", err);
    });
}
