// FlashNote Background Service Worker
// Handles extension lifecycle events

// Log when the extension is installed or updated
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('FlashNote extension installed');
  } else if (details.reason === 'update') {
    console.log(`FlashNote extension updated to version ${chrome.runtime.getManifest().version}`);
  }
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ type: 'PONG' });
    return true;
  }

  // Add more message handlers as needed
  return false;
});

// Keep service worker alive for token refresh if needed
// (Chrome MV3 service workers can go idle)
const KEEP_ALIVE_INTERVAL = 20 * 1000; // 20 seconds

let keepAliveInterval: ReturnType<typeof setInterval> | null = null;

function startKeepAlive() {
  if (keepAliveInterval) return;
  keepAliveInterval = setInterval(() => {
    // Simple ping to keep service worker active
    chrome.runtime.getPlatformInfo(() => {});
  }, KEEP_ALIVE_INTERVAL);
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

// Start keep-alive when popup opens
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    startKeepAlive();
    port.onDisconnect.addListener(() => {
      stopKeepAlive();
    });
  }
});

export {};
