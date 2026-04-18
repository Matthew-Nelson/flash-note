/**
 * PHI lifecycle integration test scaffold.
 *
 * Scenarios are added incrementally:
 *   - Plan 04-02 adds patient create/update/archive end-to-end scenarios.
 *   - Plan 04-03 adds note save/update/version/audit-in-transaction scenarios
 *     exercised against a real Postgres DB via db-harness.
 *
 * Keeping the file in place now so the test harness is wired before those
 * plans land — pnpm test auto-picks up new scenarios as they're added.
 */
import { describe, it } from 'vitest';

describe('phi lifecycle', () => {
  it.todo('patient + note + version end-to-end happy path');
  it.todo('induced rollback leaves no partial rows');
  it.todo('optimistic lock rejects stale update');
  it.todo('audit rows appear in the same transaction as the mutation');
});
