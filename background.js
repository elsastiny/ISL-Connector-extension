// background.js
chrome.action.onClicked.addListener((tab) => {
  // Launches the panel window on the right side of the active browser tab
  chrome.sidePanel.setOptions({
    tabId: tab.id,
    path: 'panel.html',
    enabled: true
  });
});