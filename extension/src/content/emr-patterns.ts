/**
 * EMR URL Pattern Configuration
 *
 * This module defines the URL patterns used to detect when a user is on an EMR system.
 * The floating button will only appear on pages matching these patterns.
 */

export interface EMRPattern {
  /** Display name for the EMR */
  name: string;
  /** Domain pattern - supports wildcards (e.g., "*.webpt.com") */
  domain: string;
  /** Optional: Only match if URL path contains this string */
  pathContains?: string;
}

/**
 * EMR patterns for common Physical Therapy EMR systems.
 */
export const EMR_PATTERNS: EMRPattern[] = [
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

  // Development/Testing (enable for local testing)
  { name: 'Localhost (Dev)', domain: 'localhost' },
];

/**
 * Check if a URL matches an EMR pattern
 */
export function matchesPattern(url: string, pattern: EMRPattern): boolean {
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
 * Check if a URL matches any EMR pattern
 */
export function matchesAnyPattern(url: string): boolean {
  for (const pattern of EMR_PATTERNS) {
    if (matchesPattern(url, pattern)) {
      return true;
    }
  }
  return false;
}
