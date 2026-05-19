document.getElementById('startBtn').addEventListener('click', () => {
  const role = document.getElementById('role').value;
  const lang = document.getElementById('lang').value;
  
  // Save settings locally in Chrome's storage
  chrome.storage.local.set({ userRole: role, userLang: lang }, () => {
    alert('ISL-Connect Activated! Refresh Google Meet.');
  });
});