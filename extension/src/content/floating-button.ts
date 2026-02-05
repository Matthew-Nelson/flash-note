/**
 * FlashNote Floating Button Content Script
 *
 * This script is injected into EMR pages to display a floating button
 * that opens the FlashNote sidepanel when clicked.
 *
 * Security Notes:
 * - This script does NOT read or scrape any data from the page
 * - It only injects a button element and sends a message to open the sidepanel
 * - No PHI is accessed, processed, or transmitted
 */

import { getActivePatterns, matchesAnyPattern } from './emr-patterns';

const BUTTON_ID = 'flashnote-floating-button';
const TOOLTIP_ID = 'flashnote-floating-tooltip';

// Track sidepanel open state
let isSidepanelOpen = false;

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
 * Check if the current page matches EMR patterns and show/hide button accordingly
 */
async function checkAndUpdateButton(): Promise<void> {
  const patterns = await getActivePatterns();
  const matchedPattern = matchesAnyPattern(window.location.href, patterns);

  if (matchedPattern) {
    createFloatingButton();
  } else {
    removeFloatingButton();
  }
}

/**
 * Initialize the content script
 */
async function init(): Promise<void> {
  // Check on initial load
  await checkAndUpdateButton();

  // Listen for URL changes (for SPAs that don't trigger full page reloads)
  let lastUrl = window.location.href;

  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      void checkAndUpdateButton();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Also listen for popstate (back/forward navigation)
  window.addEventListener('popstate', () => {
    void checkAndUpdateButton();
  });

  // Listen for storage changes (user updated patterns in settings)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      if (
        changes.flashnote_custom_emr_patterns ||
        changes.flashnote_disabled_emr_patterns
      ) {
        void checkAndUpdateButton();
      }
    }
  });
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void init());
} else {
  void init();
}
