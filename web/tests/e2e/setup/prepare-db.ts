/* eslint-disable no-console -- CLI script run before the e2e web server starts */
/**
 * Recreate the e2e database and apply migrations.
 *
 * Runs as part of the Playwright webServer command, before `next dev`, so the
 * server never holds a connection to a database that is about to be dropped.
 * (Playwright starts webServer before globalSetup, so globalSetup is too late.)
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import pg from 'pg';

import { E2E_DATABASE_URL } from './env';

const target = new URL(E2E_DATABASE_URL);
const dbName = target.pathname.slice(1);

// This script drops the database it is pointed at. Refuse anything that is not
// unmistakably a throwaway e2e database, so a stray DATABASE_URL can't wipe dev data.
if (!/^[a-z0-9_]+_e2e$/.test(dbName)) {
  console.error(`Refusing to reset "${dbName}": e2e database names must end in _e2e`);
  process.exit(1);
}

const admin = new URL(E2E_DATABASE_URL);
admin.pathname = '/postgres';

async function main() {
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    // dbName is validated against the regex above; identifiers can't be parameterized.
    await client.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await client.query(`CREATE DATABASE ${dbName}`);
  } finally {
    await client.end();
  }

  const webRoot = path.resolve(__dirname, '../../..');
  execFileSync(
    path.join(webRoot, 'node_modules/.bin/tsx'),
    [path.join(webRoot, 'src/server/db/migrate.ts')],
    { stdio: 'inherit', env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL } },
  );
  console.log(`e2e database ${dbName} ready`);
}

main().catch((error: unknown) => {
  console.error('Failed to prepare e2e database:', error);
  process.exit(1);
});
