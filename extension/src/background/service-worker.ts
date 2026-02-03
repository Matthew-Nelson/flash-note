// FlashNote Background Service Worker
// Handles extension lifecycle events and side panel

import { initSentry, captureException } from '../shared/sentry';

// Initialize Sentry for the service worker context
initSentry();

// Message types for runtime messaging
interface ExtensionMessage {
  type: string;
}

// Log when the extension is installed or updated
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    console.warn('FlashNote extension installed');
  } else if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
    console.warn(`FlashNote extension updated to version ${chrome.runtime.getManifest().version}`);
  }
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    void chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Handle messages from side panel or content scripts
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
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

// Start keep-alive when side panel connects
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidepanel') {
    startKeepAlive();
    port.onDisconnect.addListener(() => {
      stopKeepAlive();
    });
  }
});

// Global error handlers for the service worker context
// Since we filter out GlobalHandlers integration for extension safety,
// we manually capture unhandled errors here.
self.addEventListener('error', (event) => {
  captureException(event.error ?? new Error(event.message), {
    source: 'service_worker',
    errorType: 'unhandled_error',
    filename: event.filename,
    lineno: event.lineno,
  });
});

self.addEventListener('unhandledrejection', (event) => {
  captureException(
    event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason)),
    {
      source: 'service_worker',
      errorType: 'unhandled_rejection',
    }
  );
});

export {};
