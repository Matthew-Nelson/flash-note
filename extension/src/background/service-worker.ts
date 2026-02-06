// FlashNote Background Service Worker
// Handles extension lifecycle events and side panel

import { initSentry, captureException } from '../shared/sentry';

// Type for sidePanel.close() which exists in Chrome 116+ but not in @types/chrome
type SidePanelWithClose = typeof chrome.sidePanel & {
  close: (options: { windowId: number }) => Promise<void>;
};
const sidePanelApi = chrome.sidePanel as SidePanelWithClose;

// Initialize Sentry for the service worker context
initSentry();

// Message types for runtime messaging
interface ExtensionMessage {
  type:
    | 'PING'
    | 'OPEN_SIDEPANEL'
    | 'CLOSE_SIDEPANEL'
    | 'GET_SIDEPANEL_STATE'
    | 'SIDEPANEL_OPENED'
    | 'SIDEPANEL_CLOSED';
  windowId?: number;
}

// Track which windows have the sidepanel open
// Key: windowId, Value: true if open
const sidepanelOpenByWindow = new Map<number, boolean>();

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
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ type: 'PONG' });
    return true;
  }

  if (message.type === 'OPEN_SIDEPANEL') {
    // Open the side panel for the tab that sent the message
    const tabId = sender.tab?.id;
    const windowId = sender.tab?.windowId;
    if (tabId && windowId) {
      chrome.sidePanel
        .open({ tabId })
        .then(() => {
          sidepanelOpenByWindow.set(windowId, true);
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error('Failed to open side panel:', error);
          sendResponse({ success: false, error: String(error) });
        });
      return true; // Will respond asynchronously
    } else {
      sendResponse({ success: false, error: 'No tab ID available' });
      return true;
    }
  }

  if (message.type === 'CLOSE_SIDEPANEL') {
    // Close the side panel for the window that sent the message
    const windowId = sender.tab?.windowId;
    if (windowId) {
      sidePanelApi
        .close({ windowId })
        .then(() => {
          sidepanelOpenByWindow.set(windowId, false);
          sendResponse({ success: true });
        })
        .catch((error: unknown) => {
          console.error('Failed to close side panel:', error);
          sendResponse({ success: false, error: String(error) });
        });
      return true; // Will respond asynchronously
    } else {
      sendResponse({ success: false, error: 'No window ID available' });
      return true;
    }
  }

  if (message.type === 'GET_SIDEPANEL_STATE') {
    // Return whether the sidepanel is open for the sender's window
    const windowId = sender.tab?.windowId;
    if (windowId) {
      const isOpen = sidepanelOpenByWindow.get(windowId) ?? false;
      sendResponse({ isOpen });
    } else {
      sendResponse({ isOpen: false });
    }
    return true;
  }

  if (message.type === 'SIDEPANEL_OPENED') {
    // Sidepanel reports it has opened (sent from sidepanel on mount)
    if (message.windowId) {
      sidepanelOpenByWindow.set(message.windowId, true);
    }
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'SIDEPANEL_CLOSED') {
    // Sidepanel reports it is closing (sent from sidepanel on unmount)
    if (message.windowId) {
      sidepanelOpenByWindow.set(message.windowId, false);
    }
    sendResponse({ success: true });
    return true;
  }

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
// State tracking is handled via SIDEPANEL_OPENED/CLOSED messages
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
