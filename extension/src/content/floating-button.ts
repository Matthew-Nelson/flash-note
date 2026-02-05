/**
 * FlashNote Floating Button Content Script
 *
 * This script is injected into EMR pages (via manifest matches) to display
 * a floating button that opens the FlashNote sidepanel when clicked.
 *
 * Security Notes:
 * - This script does NOT read or scrape any data from the page
 * - It only injects a button element and sends a message to open the sidepanel
 * - No PHI is accessed, processed, or transmitted
 */

const BUTTON_ID = 'flashnote-floating-button';
const TOOLTIP_ID = 'flashnote-floating-tooltip';
const PREFERENCES_STORAGE_KEY = 'preferences';

// Track sidepanel open state
let isSidepanelOpen = false;

// Cached preference value (updated via storage listener)
let cachedBadgeEnabled = true;

/**
 * Load the badge preference from storage and cache it
 */
async function loadBadgePreference(): Promise<void> {
  try {
    const result = await chrome.storage.local.get(PREFERENCES_STORAGE_KEY);
    const prefs = result[PREFERENCES_STORAGE_KEY] as
      | { showFloatingBadge?: boolean }
      | undefined;
    cachedBadgeEnabled = prefs?.showFloatingBadge ?? true;
  } catch (error) {
    console.error('FlashNote: Failed to load preferences', error);
    cachedBadgeEnabled = true; // Default to showing badge
  }
}

/**
 * Create and inject the floating button into the page
 */
function createFloatingButton(): void {
  // Don't create if already exists
  if (document.getElementById(BUTTON_ID)) {
    return;
  }

  // Create the button container
  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.setAttribute('aria-label', 'Toggle FlashNote sidebar');
  button.setAttribute('title', 'FlashNote');

  // Create SVG lightning bolt icon (matches FlashNote logo style - sharp angles)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('class', 'flashnote-bolt-svg');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  // Sharp angular bolt with connected middle point
  path.setAttribute('d', 'M13 2L5 11L11 12L8 22L17 13L11 12Z');
  path.setAttribute('fill', 'white');

  svg.appendChild(path);
  button.appendChild(svg);

  // Create tooltip
  const tooltip = document.createElement('div');
  tooltip.id = TOOLTIP_ID;
  tooltip.textContent = 'FlashNote';

  // Add click handler
  button.addEventListener('click', handleButtonClick);

  // Add hover handlers for tooltip (also shift tooltip up when button lifts)
  button.addEventListener('mouseenter', () => {
    tooltip.classList.add('visible');
    tooltip.classList.add('lifted');
  });
  button.addEventListener('mouseleave', () => {
    tooltip.classList.remove('visible');
    tooltip.classList.remove('lifted');
  });

  // Inject into page
  document.body.appendChild(button);
  document.body.appendChild(tooltip);
}

/**
 * Handle button click - toggle sidepanel open/close
 */
function handleButtonClick(): void {
  const button = document.getElementById(BUTTON_ID);

  if (isSidepanelOpen) {
    // Close the sidepanel
    chrome.runtime.sendMessage({ type: 'CLOSE_SIDEPANEL' }, () => {
      if (chrome.runtime.lastError) {
        console.error(
          'FlashNote: Failed to close sidepanel',
          chrome.runtime.lastError
        );
      } else {
        isSidepanelOpen = false;
        button?.classList.remove('active');
      }
    });
  } else {
    // Open the sidepanel
    chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' }, () => {
      if (chrome.runtime.lastError) {
        console.error(
          'FlashNote: Failed to open sidepanel',
          chrome.runtime.lastError
        );
      } else {
        isSidepanelOpen = true;
        button?.classList.add('active');
      }
    });
  }
}

/**
 * Remove the floating button from the page
 */
function removeFloatingButton(): void {
  const button = document.getElementById(BUTTON_ID);
  const tooltip = document.getElementById(TOOLTIP_ID);
  if (button) {
    button.removeEventListener('click', handleButtonClick);
    button.remove();
  }
  if (tooltip) {
    tooltip.remove();
  }
}

/**
 * Update button visibility based on cached preference
 */
function updateButtonVisibility(): void {
  if (cachedBadgeEnabled) {
    createFloatingButton();
  } else {
    removeFloatingButton();
  }
}

/**
 * Initialize the content script
 */
async function init(): Promise<void> {
  // Load preference and show button on initial load
  await loadBadgePreference();
  updateButtonVisibility();

  // Listen for SPA navigation via History API
  const originalPushState = history.pushState.bind(history);
  history.pushState = function (...args) {
    originalPushState(...args);
    updateButtonVisibility();
  };

  const originalReplaceState = history.replaceState.bind(history);
  history.replaceState = function (...args) {
    originalReplaceState(...args);
    updateButtonVisibility();
  };

  // Listen for back/forward navigation
  window.addEventListener('popstate', () => {
    updateButtonVisibility();
  });

  // Listen for preference changes and update cache
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.preferences) {
      const newPrefs = changes.preferences.newValue as
        | { showFloatingBadge?: boolean }
        | undefined;
      cachedBadgeEnabled = newPrefs?.showFloatingBadge ?? true;
      updateButtonVisibility();
    }
  });
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void init());
} else {
  void init();
}
