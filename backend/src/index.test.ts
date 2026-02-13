import { describe, it, expect, vi } from 'vitest';

// Mock all dependencies to isolate app configuration testing.
// index.ts has heavy side effects (server startup, process handlers),
// so we mock everything except express itself.

const { mockSentry } = vi.hoisted(() => ({
  mockSentry: {
    setupExpressErrorHandler: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    captureException: vi.fn(),
  },
}));

vi.mock('./env-loader.js', () => ({}));
vi.mock('./instrument.js', () => ({ Sentry: mockSentry }));
vi.mock('./config.js', () => ({
  config: { PORT: 0, NODE_ENV: 'test', ALLOWED_ORIGINS: [] },
}));
vi.mock('./db/index.js', () => ({
  db: { end: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('./middleware/error-handler.js', () => ({
  errorHandler: vi.fn(),
}));
vi.mock('./routes/health.js', () => ({ healthRouter: vi.fn() }));
vi.mock('./routes/auth.js', () => ({ authRouter: vi.fn() }));
vi.mock('./routes/notes.js', () => ({ notesRouter: vi.fn() }));
vi.mock('./routes/billing.js', () => ({ billingRouter: vi.fn() }));
vi.mock('./routes/user.js', () => ({ userRouter: vi.fn() }));
vi.mock('./routes/organization.js', () => ({ organizationRouter: vi.fn() }));
vi.mock('./routes/usage.js', () => ({ usageRouter: vi.fn() }));

import app from './index.js';

describe('App configuration', () => {
  it('should set trust proxy to 1 (CR-3)', () => {
    // trust proxy = 1 means trust one proxy hop (correct for single reverse proxy
    // deployments like Render/Railway/Heroku). Without this, req.ip returns the
    // proxy IP, breaking rate limiting and audit logs.
    expect(app.get('trust proxy')).toBe(1);
  });
});
