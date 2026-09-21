export function setupContextMenus() {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: "vocab-extend-capture",
            title: "Tra từ '%s' & Lưu vào VocabExtend",
            contexts: ["selection"],
        });
    });
}
export async function handleContextMenuClick(info, tab) {
    if (info.menuItemId !== "vocab-extend-capture")
        return;
    const selectedText = info.selectionText?.trim();
    if (!selectedText || !tab?.id)
        return;
    const capturePayload = {
        word: selectedText,
        sourceUrl: tab.url || "",
        sourceTitle: tab.title || "",
        capturedAt: new Date().toISOString(),
    };
    // 1. Save to chrome.storage.session or local so SidePanel can immediately read it
    await chrome.storage.local.set({ pendingCapture: capturePayload });
    // 2. Open Side Panel for this window
    if (chrome.sidePanel && chrome.sidePanel.open) {
        if (tab.windowId) {
            await chrome.sidePanel.open({ windowId: tab.windowId });
        }
    }
    // 3. Notify any already-open Side Panel
    chrome.runtime.sendMessage({
        type: "NEW_SELECTION_CAPTURE",
        payload: capturePayload,
    }).catch(() => {
        // Side panel might not be open yet, it will read pendingCapture from storage on mount
    });
}
