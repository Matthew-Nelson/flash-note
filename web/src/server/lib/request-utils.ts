import 'server-only';

import { isIP } from 'node:net';

/**
 * Validates an IP address string for safe insertion into PostgreSQL INET columns.
 * Returns the IP if valid (IPv4 or IPv6), or null if malformed.
 * Prevents DB errors from invalid INET values inside transactions.
 */
export function sanitizeIpAddress(ip: string | undefined | null): string | null {
  if (!ip) return null;
  return isIP(ip) ? ip : null;
}
