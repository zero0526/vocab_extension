import { setupContextMenus, handleContextMenuClick } from "./context-menu";
chrome.runtime.onInstalled.addListener(() => {
    setupContextMenus();
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
    handleContextMenuClick(info, tab);
});
// Set side panel behavior to open on action click as well
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => { });
}
// Handle internal extension messages
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "OPEN_DASHBOARD") {
        chrome.tabs.create({ url: chrome.runtime.getURL("src/dashboard/index.html") });
        sendResponse({ success: true });
    }
    return true;
});
