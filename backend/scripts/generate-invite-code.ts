/* eslint-disable no-console -- CLI script with intentional stdout output */
/**
 * Invite Code Generation Script
 *
 * Generates a single-use invite code for beta or clinic registration.
 * Creates its own database connection (only needs DATABASE_URL).
 *
 * Usage:
 *   npx tsx scripts/generate-invite-code.ts --type=beta --created-by=<user-uuid> --expires=30d
 *   npx tsx scripts/generate-invite-code.ts --type=clinic --created-by=<user-uuid> --expires=30d --org-id=<uuid>
 *
 * Options:
 *   --type        Required. 'beta' or 'clinic'
 *   --created-by  Required. UUID of the admin user generating the code
 *   --expires     Optional. Expiry duration (default: 30d). Format: <number>d (days)
 *   --org-id      Optional. Organization UUID (required for clinic codes in PR 1C+)
 */

// Load environment variables (standalone script)
import '../src/env-loader.js';

import pg from 'pg';
import { generateCodeString } from '../src/utils/invite-code-format.js';

const { Pool } = pg;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseArgs(argv: string[]): {
  type: 'beta' | 'clinic';
  createdBy: string;
  expiresDays: number;
  orgId: string | null;
} {
  const args = argv.slice(2);
  let type: string | undefined;
  let createdBy: string | undefined;
  let expiresDays = 30;
  let orgId: string | null = null;

  for (const arg of args) {
    if (arg.startsWith('--type=')) {
      type = arg.split('=')[1];
    } else if (arg.startsWith('--created-by=')) {
      createdBy = arg.split('=')[1];
    } else if (arg.startsWith('--expires=')) {
      const val = arg.split('=')[1]!;
      const match = val.match(/^(\d+)d$/);
      if (!match) {
        console.error('Error: --expires must be in format <number>d (e.g., 30d)');
        process.exit(1);
      }
      expiresDays = parseInt(match[1]!, 10);
    } else if (arg.startsWith('--org-id=')) {
      orgId = arg.split('=')[1]!;
    }
  }

  if (!type || (type !== 'beta' && type !== 'clinic')) {
    console.error('Error: --type is required and must be "beta" or "clinic"');
    console.error('Usage: npx tsx scripts/generate-invite-code.ts --type=beta --created-by=<uuid> --expires=30d');
    process.exit(1);
  }

  if (!createdBy) {
    console.error('Error: --created-by is required (UUID of admin user)');
    process.exit(1);
  }

  if (!UUID_REGEX.test(createdBy)) {
    console.error('Error: --created-by must be a valid UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)');
    process.exit(1);
  }

  if (orgId && !UUID_REGEX.test(orgId)) {
    console.error('Error: --org-id must be a valid UUID');
    process.exit(1);
  }

  return { type: type as 'beta' | 'clinic', createdBy, expiresDays, orgId };
}

async function main() {
  const { type, createdBy, expiresDays, orgId } = parseArgs(process.argv);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Error: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // Generate a unique code (retry on collision)
    let code: string | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateCodeString();
      const existing = await pool.query('SELECT id FROM invite_codes WHERE code = $1', [candidate]);
      if (existing.rows.length === 0) {
        code = candidate;
        break;
      }
    }

    if (!code) {
      console.error('Error: Failed to generate unique code after 5 attempts');
      process.exit(1);
    }

    const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO invite_codes (code, type, created_by, expires_at, organization_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [code, type, createdBy, expiresAt, orgId]
    );

    console.log(`Code: ${code} | Type: ${type} | Expires: ${expiresAt.toISOString().split('T')[0]}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Failed to generate invite code:', error);
  process.exit(1);
});
