/**
 * Allowed redirect hosts for Stripe URLs.
 * Validates redirect URLs from billing responses before navigating.
 * Prevents open redirect attacks.
 */
const ALLOWED_REDIRECT_HOSTS = ['checkout.stripe.com', 'billing.stripe.com'];

export function isAllowedRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ALLOWED_REDIRECT_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}
