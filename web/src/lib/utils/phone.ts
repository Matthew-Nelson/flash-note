/**
 * Phone number formatting helpers.
 *
 * FlashNote stores phone numbers as user-entered strings (the DB column is
 * `phone TEXT`, validated only for max length — see `createPatientSchema`).
 * These helpers present a consistent US-style format for the two common
 * patient-intake cases (10-digit full number, 7-digit local number) while
 * leaving anything else (international numbers, extensions, free-form text)
 * untouched.
 *
 * No PHI is ever logged from these helpers — they are pure string transforms.
 */

/** Strip everything except digits. */
function digitsOnly(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * Format a stored phone value for display.
 *
 * - 10-digit US: `5551234567`  -> `(555) 123-4567`
 * - 11-digit US (leading 1):    `15551234567` -> `1 (555) 123-4567`
 * - 7-digit local: `5551234`    -> `555-1234`
 * - Anything else (empty, international, letters, etc.): returned verbatim.
 *
 * Input is assumed to already be validated at the form boundary (max 32
 * chars by Zod). This helper NEVER throws — unusable input falls through
 * to the verbatim return.
 */
export function formatPhoneDisplay(
  phone: string | null | undefined,
): string {
  if (!phone) return '';
  const raw = phone.trim();
  if (!raw) return '';

  // Preserve free-form input verbatim: anything with letters (extensions,
  // "call me", TTY markers) OR a leading "+" (international notation).
  if (/[A-Za-z]/.test(raw) || raw.startsWith('+')) return raw;

  const digits = digitsOnly(raw);

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  // Non-standard length (e.g. 3, 5 digits) — return the raw trimmed value so
  // the clinician sees exactly what they entered.
  return raw;
}

/**
 * Progressively format a partial phone number while the user is typing
 * (input mask). Matches the semantics of `formatPhoneDisplay` but is safe to
 * call on every keystroke — it never "over-formats" (e.g. won't add a
 * trailing dash that would cause cursor-jump issues) and preserves
 * non-digit-heavy free-form input (e.g. "+44 20 7946 0958").
 *
 * Progression for US-style input:
 *   ""            -> ""
 *   "5"           -> "5"
 *   "555"         -> "555"
 *   "5551"        -> "555-1"
 *   "5551234"     -> "555-1234"
 *   "55512345"    -> "(555) 123-45"
 *   "5551234567"  -> "(555) 123-4567"
 *   "15551234567" -> "1 (555) 123-4567"
 *
 * If input contains non-digit chars other than spaces, dashes, parens, dots,
 * or plus (i.e. a letter or an explicit "+" prefix), we treat it as
 * "free-form" and return it as-is — this covers international numbers and
 * extension-style inputs (e.g. "555-0100 x123").
 */
export function formatPhoneInput(input: string): string {
  if (!input) return '';

  // Free-form fallback: if the input has letters or a leading "+", the user is
  // typing something we shouldn't mangle (international, extension notation,
  // etc.). Return verbatim — the submit path will still cap at 32 chars.
  if (/[A-Za-z]/.test(input) || input.trim().startsWith('+')) {
    return input;
  }

  const digits = digitsOnly(input);
  if (digits.length === 0) return '';

  // 11-digit US (with leading 1)
  if (digits.length >= 11 && digits.startsWith('1')) {
    const d = digits.slice(0, 11);
    return `1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 11)}`;
  }

  // 10-digit US full number — always format once we have 7+ digits, using the
  // (XXX) XXX-XXXX shape so the cursor-at-end typing flow looks natural.
  if (digits.length > 7) {
    const d = digits.slice(0, 10);
    const area = d.slice(0, 3);
    const prefix = d.slice(3, 6);
    const line = d.slice(6);
    return line ? `(${area}) ${prefix}-${line}` : `(${area}) ${prefix}`;
  }

  // 7-digit local or partial local (4-7 digits): XXX-XXXX
  if (digits.length > 3) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  // 1-3 digits — no punctuation yet.
  return digits;
}
