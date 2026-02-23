import { describe, it, expect, beforeEach } from 'vitest';
import { mockDbQuery, mockClientQuery, resetMocks } from '../../test/setup.js';
import {
  generateCodeString,
  generateUniqueCode,
  createInviteCode,
  findByCode,
  findByCodeForUpdate,
  markCodeAsUsed,
  revokeCode,
  validateCodeRedeemable,
  type InviteCode,
} from './invite-codes.js';

function createMockInviteCodeRow(overrides: Partial<{
  id: string;
  code: string;
  type: 'beta' | 'clinic';
  organization_id: string | null;
  created_by: string;
  used_by: string | null;
  used_at: Date | null;
  expires_at: Date;
  is_active: boolean;
  created_at: Date;
}> = {}) {
  return {
    id: 'code-uuid-1',
    code: 'AB3K-M7RN',
    type: 'beta' as const,
    organization_id: null,
    created_by: 'admin-uuid',
    used_by: null,
    used_at: null,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    is_active: true,
    created_at: new Date(),
    ...overrides,
  };
}

describe('Invite Code Queries', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('generateCodeString', () => {
    it('should generate code in XXXX-XXXX format', () => {
      const code = generateCodeString();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    });

    it('should not contain ambiguous characters (O, I, L, 0, 1)', () => {
      // Generate many codes and verify no ambiguous characters
      for (let i = 0; i < 100; i++) {
        const code = generateCodeString();
        expect(code).not.toMatch(/[OIL01]/);
      }
    });

    it('should generate different codes on consecutive calls', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 20; i++) {
        codes.add(generateCodeString());
      }
      // With 31^8 combinations, 20 codes should all be unique
      expect(codes.size).toBe(20);
    });
  });

  describe('generateUniqueCode', () => {
    it('should return a code that does not exist in the database', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] }); // No collision

      const code = await generateUniqueCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
      expect(mockDbQuery).toHaveBeenCalledWith(
        'SELECT id FROM invite_codes WHERE code = $1',
        [expect.any(String)]
      );
    });

    it('should retry on collision and return a new code', async () => {
      // First attempt: collision
      mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'existing-id' }] });
      // Second attempt: no collision
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const code = await generateUniqueCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
      expect(mockDbQuery).toHaveBeenCalledTimes(2);
    });

    it('should throw after maximum retries', async () => {
      // All 5 attempts: collision
      for (let i = 0; i < 5; i++) {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: `existing-${i}` }] });
      }

      await expect(generateUniqueCode()).rejects.toThrow(
        'Failed to generate unique invite code after maximum retries'
      );
    });
  });

  describe('createInviteCode', () => {
    it('should insert a beta invite code', async () => {
      const mockRow = createMockInviteCodeRow();
      mockDbQuery.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await createInviteCode(
        'AB3K-M7RN',
        'beta',
        'admin-uuid',
        new Date('2026-03-11')
      );

      expect(result.code).toBe('AB3K-M7RN');
      expect(result.type).toBe('beta');
      expect(result.organizationId).toBeNull();
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO invite_codes'),
        ['AB3K-M7RN', 'beta', 'admin-uuid', new Date('2026-03-11'), null]
      );
    });

    it('should insert a clinic invite code with organization_id', async () => {
      const mockRow = createMockInviteCodeRow({
        type: 'clinic',
        organization_id: 'org-uuid',
      });
      mockDbQuery.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await createInviteCode(
        'XY4P-Q8HN',
        'clinic',
        'admin-uuid',
        new Date('2026-03-11'),
        'org-uuid'
      );

      expect(result.type).toBe('clinic');
      expect(result.organizationId).toBe('org-uuid');
    });
  });

  describe('findByCode', () => {
    it('should return invite code when found', async () => {
      const mockRow = createMockInviteCodeRow();
      mockDbQuery.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await findByCode('AB3K-M7RN');

      expect(result).not.toBeNull();
      expect(result!.code).toBe('AB3K-M7RN');
      expect(result!.isActive).toBe(true);
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['AB3K-M7RN']
      );
    });

    it('should return null when code not found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const result = await findByCode('ZZZZ-ZZZZ');

      expect(result).toBeNull();
    });
  });

  describe('findByCodeForUpdate', () => {
    it('should select with FOR UPDATE lock using client', async () => {
      const mockRow = createMockInviteCodeRow();
      mockClientQuery.mockResolvedValueOnce({ rows: [mockRow] });

      const mockClient = { query: mockClientQuery } as unknown as import('pg').PoolClient;
      const result = await findByCodeForUpdate(mockClient, 'AB3K-M7RN');

      expect(result).not.toBeNull();
      expect(result!.code).toBe('AB3K-M7RN');
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('FOR UPDATE'),
        ['AB3K-M7RN']
      );
    });

    it('should return null when code not found', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const mockClient = { query: mockClientQuery } as unknown as import('pg').PoolClient;
      const result = await findByCodeForUpdate(mockClient, 'XXXX-XXXX');

      expect(result).toBeNull();
    });
  });

  describe('markCodeAsUsed', () => {
    it('should update used_by, used_at, and set is_active to false', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const mockClient = { query: mockClientQuery } as unknown as import('pg').PoolClient;
      await markCodeAsUsed(mockClient, 'code-uuid-1', 'user-uuid-1');

      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE invite_codes SET used_by'),
        ['user-uuid-1', 'code-uuid-1']
      );
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_active = FALSE'),
        ['user-uuid-1', 'code-uuid-1']
      );
    });
  });

  describe('revokeCode', () => {
    it('should set is_active to false', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await revokeCode('code-uuid-1');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_active = FALSE'),
        ['code-uuid-1']
      );
    });
  });

  describe('validateCodeRedeemable', () => {
    it('should return null for a valid, redeemable code', () => {
      const code: InviteCode = {
        id: 'code-uuid-1',
        code: 'AB3K-M7RN',
        type: 'beta',
        organizationId: null,
        createdBy: 'admin-uuid',
        usedBy: null,
        usedAt: null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true,
        createdAt: new Date(),
      };

      expect(validateCodeRedeemable(code)).toBeNull();
    });

    it('should return "inactive" for a revoked code', () => {
      const code: InviteCode = {
        id: 'code-uuid-1',
        code: 'AB3K-M7RN',
        type: 'beta',
        organizationId: null,
        createdBy: 'admin-uuid',
        usedBy: null,
        usedAt: null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: false,
        createdAt: new Date(),
      };

      expect(validateCodeRedeemable(code)).toBe('inactive');
    });

    it('should return "already_used" for a used code', () => {
      const code: InviteCode = {
        id: 'code-uuid-1',
        code: 'AB3K-M7RN',
        type: 'beta',
        organizationId: null,
        createdBy: 'admin-uuid',
        usedBy: 'some-user-id',
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true,
        createdAt: new Date(),
      };

      expect(validateCodeRedeemable(code)).toBe('already_used');
    });

    it('should return "expired" for an expired code', () => {
      const code: InviteCode = {
        id: 'code-uuid-1',
        code: 'AB3K-M7RN',
        type: 'beta',
        organizationId: null,
        createdBy: 'admin-uuid',
        usedBy: null,
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
        isActive: true,
        createdAt: new Date(),
      };

      expect(validateCodeRedeemable(code)).toBe('expired');
    });
  });
});
