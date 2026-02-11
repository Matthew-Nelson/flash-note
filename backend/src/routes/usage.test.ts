import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';

// Mock dependencies with vi.hoisted for proper hoisting
const mockGetMonthlyUsage = vi.fn();
const mockFindUserById = vi.fn();
const mockFindActiveMembership = vi.fn();
const mockFindOrganizationById = vi.fn();

vi.mock('../middleware/auth.js', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: NextFunction) => next(),
}));

vi.mock('../middleware/rate-limit.js', () => ({
  apiRateLimit: (_req: unknown, _res: unknown, next: NextFunction) => next(),
}));

vi.mock('../services/usage-service.js', () => ({
  usageService: {
    getMonthlyUsage: (...args: unknown[]) => mockGetMonthlyUsage(...args),
  },
}));

vi.mock('../db/queries/users.js', () => ({
  findUserById: (...args: unknown[]) => mockFindUserById(...args),
}));

vi.mock('../db/queries/organization-members.js', () => ({
  findActiveMembership: (...args: unknown[]) => mockFindActiveMembership(...args),
}));

vi.mock('../db/queries/organizations.js', () => ({
  findOrganizationById: (...args: unknown[]) => mockFindOrganizationById(...args),
}));

vi.mock('../middleware/error-handler.js', () => ({
  AppError: class AppError extends Error {
    constructor(
      public statusCode: number,
      public code: string,
      message: string
    ) {
      super(message);
    }
  },
}));

vi.mock('../instrument.js', () => ({
  Sentry: {
    captureException: vi.fn(),
  },
}));

// Import after mocking
import { usageRouter } from './usage.js';
import express from 'express';
import request from 'supertest';

function createApp() {
  const app = express();
  app.use(express.json());
  // Simulate requireAuth attaching user to request
  app.use((req, _res, next) => {
    (req as AuthenticatedRequest).user = {
      userId: 'test-user-id',
      email: 'test@example.com',
      tokenVersion: 1,
    };
    next();
  });
  app.use('/usage', usageRouter);
  // Simple error handler for tests
  app.use((err: { statusCode?: number; code?: string; message: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.statusCode || 500;
    res.status(status).json({
      success: false,
      error: { code: err.code || 'internal_error', message: err.message },
    });
  });
  return app;
}

describe('GET /usage/me', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('should return usage for individual user (no org) with organization: null', async () => {
    mockFindUserById.mockResolvedValueOnce({
      id: 'test-user-id',
      email: 'test@example.com',
      organizationId: null,
    });
    mockGetMonthlyUsage.mockResolvedValueOnce({
      notesGenerated: 15,
      inputTokens: 1000,
      outputTokens: 2000,
      totalTokens: 3000,
    });

    const res = await request(app).get('/usage/me');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.notesGenerated).toBe(15);
    expect(res.body.data.organization).toBeNull();
  });

  it('should return usage with org context (name + role)', async () => {
    mockFindUserById.mockResolvedValueOnce({
      id: 'test-user-id',
      email: 'test@example.com',
      organizationId: 'org-uuid',
    });
    mockGetMonthlyUsage.mockResolvedValueOnce({
      notesGenerated: 42,
      inputTokens: 5000,
      outputTokens: 8000,
      totalTokens: 13000,
    });
    mockFindActiveMembership.mockResolvedValueOnce({
      organizationId: 'org-uuid',
      role: 'member',
      isBillable: true,
    });
    mockFindOrganizationById.mockResolvedValueOnce({
      id: 'org-uuid',
      name: 'Acme PT',
      maxSeats: 5,
      stripeCustomerId: null,
      subscriptionId: null,
      subscriptionStatus: 'active',
      trialEndsAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app).get('/usage/me');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.notesGenerated).toBe(42);
    expect(res.body.data.organization).toEqual({
      name: 'Acme PT',
      role: 'member',
    });
  });

  it('should return zeros when no usage record exists', async () => {
    mockFindUserById.mockResolvedValueOnce({
      id: 'test-user-id',
      email: 'test@example.com',
      organizationId: null,
    });
    mockGetMonthlyUsage.mockResolvedValueOnce({
      notesGenerated: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });

    const res = await request(app).get('/usage/me');

    expect(res.status).toBe(200);
    expect(res.body.data.notesGenerated).toBe(0);
  });

  it('should NOT expose inputTokens, outputTokens, or totalTokens', async () => {
    mockFindUserById.mockResolvedValueOnce({
      id: 'test-user-id',
      email: 'test@example.com',
      organizationId: null,
    });
    mockGetMonthlyUsage.mockResolvedValueOnce({
      notesGenerated: 10,
      inputTokens: 500,
      outputTokens: 1500,
      totalTokens: 2000,
    });

    const res = await request(app).get('/usage/me');

    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('inputTokens');
    expect(res.body.data).not.toHaveProperty('outputTokens');
    expect(res.body.data).not.toHaveProperty('totalTokens');
  });

  it('should return currentMonth in YYYY-MM format', async () => {
    mockFindUserById.mockResolvedValueOnce({
      id: 'test-user-id',
      email: 'test@example.com',
      organizationId: null,
    });
    mockGetMonthlyUsage.mockResolvedValueOnce({
      notesGenerated: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });

    const res = await request(app).get('/usage/me');

    expect(res.status).toBe(200);
    expect(res.body.data.currentMonth).toMatch(/^\d{4}-\d{2}$/);
  });

  it('should return 404 when user not found', async () => {
    mockFindUserById.mockResolvedValueOnce(null);

    const res = await request(app).get('/usage/me');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('not_found');
  });

  it('should handle stale organizationId gracefully (membership removed but organization_id not cleared)', async () => {
    mockFindUserById.mockResolvedValueOnce({
      id: 'test-user-id',
      email: 'test@example.com',
      organizationId: 'stale-org-uuid',
    });
    mockGetMonthlyUsage.mockResolvedValueOnce({
      notesGenerated: 5,
      inputTokens: 100,
      outputTokens: 200,
      totalTokens: 300,
    });
    // Membership was removed — findActiveMembership returns null
    mockFindActiveMembership.mockResolvedValueOnce(null);

    const res = await request(app).get('/usage/me');

    expect(res.status).toBe(200);
    expect(res.body.data.notesGenerated).toBe(5);
    expect(res.body.data.organization).toBeNull();
    // Should not have called findOrganizationById since membership is null
    expect(mockFindOrganizationById).not.toHaveBeenCalled();
  });
});
