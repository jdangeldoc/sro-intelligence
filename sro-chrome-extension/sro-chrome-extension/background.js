// SRO Intelligence - Chrome Extension Background Service Worker

// When extension is installed, set default URL
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get('sroUrl', (result) => {
    if (!result.sroUrl) {
      chrome.storage.local.set({ sroUrl: 'http://localhost:3000' });
    }
  });

  // Enable side panel to open on action click
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
});
