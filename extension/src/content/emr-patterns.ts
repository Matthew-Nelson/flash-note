/**
 * EMR URL Pattern Configuration
 *
 * This module defines the URL patterns used to detect when a user is on an EMR system.
 * The floating button will only appear on pages matching these patterns.
 *
 * Pattern Types:
 * - domain: Matches the hostname (supports wildcards like *.webpt.com)
 * - pathContains: Optional - only show on pages where the path contains this string
 *
 * Adding New EMRs:
 * 1. Add a new entry to DEFAULT_EMR_PATTERNS
 * 2. Users can also add custom patterns via extension settings (stored in chrome.storage.local)
 */

export interface EMRPattern {
  /** Display name for the EMR (used in settings UI) */
  name: string;
  /** Domain pattern - supports wildcards (e.g., "*.webpt.com", "clinicient.com") */
  domain: string;
  /** Optional: Only match if URL path contains this string */
  pathContains?: string;
  /** Whether this pattern is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Default EMR patterns for common Physical Therapy EMR systems.
 * These are bundled with the extension and can't be removed by users,
 * but users can disable them or add their own custom patterns.
 */
export const DEFAULT_EMR_PATTERNS: EMRPattern[] = [
  // Major PT-specific EMRs
  { name: 'WebPT', domain: '*.webpt.com' },
  { name: 'Clinicient (Prompt)', domain: '*.clinicient.com' },
  { name: 'Clinicient (Prompt)', domain: '*.promptemr.com' },
  { name: 'TheraOffice', domain: '*.theraoffice.com' },
  { name: 'Raintree', domain: '*.rfraintree.com' },
  { name: 'Net Health (Optima)', domain: '*.nethealth.com' },
  { name: 'Net Health (ReDoc)', domain: '*.redocnow.com' },
  { name: 'Kareo', domain: '*.kareo.com' },
  { name: 'Practice Perfect', domain: '*.practiceperfect.com' },
  { name: 'BetterPT', domain: '*.betterpt.com' },
  { name: 'Jane App', domain: '*.janeapp.com' },
  { name: 'SimplePractice', domain: '*.simplepractice.com' },
  { name: 'Fusion Web Clinic', domain: '*.fusionwebclinic.com' },
  { name: 'FOTO', domain: '*.fotoinc.com' },
  { name: 'MWTherapy', domain: '*.mwtherapy.com' },
  { name: 'TheraGo', domain: '*.therago.com' },

  // Hospital/Enterprise EMRs (PT documentation modules)
  { name: 'Epic', domain: '*.epic.com' },
  { name: 'Epic (MyChart)', domain: '*.mychart.com' },
  { name: 'Cerner', domain: '*.cerner.com' },
  { name: 'Athenahealth', domain: '*.athenahealth.com' },
  { name: 'eClinicalWorks', domain: '*.eclinicalworks.com' },
  { name: 'Allscripts', domain: '*.allscripts.com' },
  { name: 'NextGen', domain: '*.nextgen.com' },
  { name: 'AdvancedMD', domain: '*.advancedmd.com' },
  { name: 'DrChrono', domain: '*.drchrono.com' },
  { name: 'ModMed', domain: '*.modmed.com' },

  // Development/Testing
  { name: 'Localhost (Dev)', domain: 'localhost', enabled: true },
];

/**
 * Storage key for user's custom EMR patterns
 */
export const CUSTOM_PATTERNS_STORAGE_KEY = 'flashnote_custom_emr_patterns';

/**
 * Storage key for disabled default patterns
 */
export const DISABLED_PATTERNS_STORAGE_KEY = 'flashnote_disabled_emr_patterns';

/**
 * Check if a URL matches an EMR pattern
 */
export function matchesPattern(url: string, pattern: EMRPattern): boolean {
  if (pattern.enabled === false) {
    return false;
  }

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const patternDomain = pattern.domain.toLowerCase();

    // Check domain match
    let domainMatches = false;

    if (patternDomain.startsWith('*.')) {
      // Wildcard subdomain match (e.g., *.webpt.com matches app.webpt.com)
      const baseDomain = patternDomain.slice(2);
      domainMatches =
        hostname === baseDomain || hostname.endsWith('.' + baseDomain);
    } else {
      // Exact domain match
      domainMatches = hostname === patternDomain;
    }

    if (!domainMatches) {
      return false;
    }

    // Check path contains (if specified)
    if (pattern.pathContains) {
      const path = urlObj.pathname.toLowerCase();
      if (!path.includes(pattern.pathContains.toLowerCase())) {
        return false;
      }
    }

    return true;
  } catch {
    // Invalid URL
    return false;
  }
}

/**
 * Check if a URL matches any of the provided EMR patterns
 */
export function matchesAnyPattern(
  url: string,
  patterns: EMRPattern[]
): EMRPattern | null {
  for (const pattern of patterns) {
    if (matchesPattern(url, pattern)) {
      return pattern;
    }
  }
  return null;
}

/**
 * Get all active EMR patterns (defaults + user custom, minus disabled)
 */
export async function getActivePatterns(): Promise<EMRPattern[]> {
  const result = await chrome.storage.local.get([
    CUSTOM_PATTERNS_STORAGE_KEY,
    DISABLED_PATTERNS_STORAGE_KEY,
  ]);

  const customPatterns: EMRPattern[] =
    result[CUSTOM_PATTERNS_STORAGE_KEY] || [];
  const disabledDomains: string[] =
    result[DISABLED_PATTERNS_STORAGE_KEY] || [];

  // Filter out disabled default patterns
  const activeDefaults = DEFAULT_EMR_PATTERNS.filter(
    (p) => p.enabled !== false && !disabledDomains.includes(p.domain)
  );

  // Combine with custom patterns
  return [...activeDefaults, ...customPatterns];
}

/**
 * Add a custom EMR pattern
 */
export async function addCustomPattern(pattern: EMRPattern): Promise<void> {
  const result = await chrome.storage.local.get(CUSTOM_PATTERNS_STORAGE_KEY);
  const customPatterns: EMRPattern[] =
    result[CUSTOM_PATTERNS_STORAGE_KEY] || [];

  // Don't add duplicates
  if (!customPatterns.some((p) => p.domain === pattern.domain)) {
    customPatterns.push(pattern);
    await chrome.storage.local.set({
      [CUSTOM_PATTERNS_STORAGE_KEY]: customPatterns,
    });
  }
}

/**
 * Remove a custom EMR pattern
 */
export async function removeCustomPattern(domain: string): Promise<void> {
  const result = await chrome.storage.local.get(CUSTOM_PATTERNS_STORAGE_KEY);
  const customPatterns: EMRPattern[] =
    result[CUSTOM_PATTERNS_STORAGE_KEY] || [];

  const filtered = customPatterns.filter((p) => p.domain !== domain);
  await chrome.storage.local.set({
    [CUSTOM_PATTERNS_STORAGE_KEY]: filtered,
  });
}

/**
 * Disable a default EMR pattern
 */
export async function disableDefaultPattern(domain: string): Promise<void> {
  const result = await chrome.storage.local.get(DISABLED_PATTERNS_STORAGE_KEY);
  const disabledDomains: string[] =
    result[DISABLED_PATTERNS_STORAGE_KEY] || [];

  if (!disabledDomains.includes(domain)) {
    disabledDomains.push(domain);
    await chrome.storage.local.set({
      [DISABLED_PATTERNS_STORAGE_KEY]: disabledDomains,
    });
  }
}

/**
 * Re-enable a default EMR pattern
 */
export async function enableDefaultPattern(domain: string): Promise<void> {
  const result = await chrome.storage.local.get(DISABLED_PATTERNS_STORAGE_KEY);
  const disabledDomains: string[] =
    result[DISABLED_PATTERNS_STORAGE_KEY] || [];

  const filtered = disabledDomains.filter((d) => d !== domain);
  await chrome.storage.local.set({
    [DISABLED_PATTERNS_STORAGE_KEY]: filtered,
  });
}
