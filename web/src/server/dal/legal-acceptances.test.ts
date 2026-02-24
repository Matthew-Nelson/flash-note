import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordLegalAcceptances } from './legal-acceptances';
import { LEGAL_DOCUMENT_VERSIONS } from '@/server/db/config';

// Mock the config module to provide stable versions for testing
vi.mock('@/server/db/config', () => ({
  LEGAL_DOCUMENT_VERSIONS: {
    baa: '0.1',
    terms_of_service: '0.1',
    privacy_policy: '0.1',
  },
}));

// T1 fix: Do NOT mock sanitizeIpAddress — let the real function run.
// This verifies that the source code actually calls sanitizeIpAddress.

describe('legal-acceptances queries', () => {
  let mockClient: {
    query: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
    };
  });

  describe('recordLegalAcceptances', () => {
    it('should insert one row per document type', async () => {
      const mockRow = {
        id: 'test-id',
        user_id: 'user-1',
        document_type: 'baa',
        document_version: '0.1',
        ip_address: '127.0.0.1',
        user_agent: 'TestAgent',
        accepted_at: new Date(),
      };

      mockClient.query.mockResolvedValue({ rows: [mockRow] });

      const result = await recordLegalAcceptances(
        mockClient as never,
        'user-1',
        '127.0.0.1',
        'TestAgent'
      );

      expect(mockClient.query).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(3);
    });

    it('should use correct document types and versions', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{
          id: 'test-id',
          user_id: 'user-1',
          document_type: 'baa',
          document_version: '0.1',
          ip_address: null,
          user_agent: null,
          accepted_at: new Date(),
        }],
      });

      await recordLegalAcceptances(mockClient as never, 'user-1', null, null);

      const docTypes = Object.keys(LEGAL_DOCUMENT_VERSIONS);
      expect(mockClient.query).toHaveBeenCalledTimes(docTypes.length);

      docTypes.forEach((docType, index) => {
        const call = mockClient.query.mock.calls[index];
        const params = call[1] as string[];
        expect(params[0]).toBe('user-1');
        expect(params[1]).toBe(docType);
        expect(params[2]).toBe(LEGAL_DOCUMENT_VERSIONS[docType as keyof typeof LEGAL_DOCUMENT_VERSIONS]);
        expect(params[3]).toBeNull();
        expect(params[4]).toBeNull();
      });
    });

    it('should pass valid IP address through sanitizeIpAddress', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{
          id: 'test-id',
          user_id: 'user-1',
          document_type: 'baa',
          document_version: '0.1',
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
          accepted_at: new Date(),
        }],
      });

      await recordLegalAcceptances(
        mockClient as never,
        'user-1',
        '192.168.1.1',
        'Mozilla/5.0'
      );

      for (const call of mockClient.query.mock.calls) {
        const params = call[1] as string[];
        expect(params[3]).toBe('192.168.1.1');
        expect(params[4]).toBe('Mozilla/5.0');
      }
    });

    it('should sanitize invalid IP addresses to null', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{
          id: 'test-id',
          user_id: 'user-1',
          document_type: 'baa',
          document_version: '0.1',
          ip_address: null,
          user_agent: null,
          accepted_at: new Date(),
        }],
      });

      await recordLegalAcceptances(
        mockClient as never,
        'user-1',
        'not-a-valid-ip',
        null
      );

      // sanitizeIpAddress should have converted the invalid IP to null
      for (const call of mockClient.query.mock.calls) {
        const params = call[1] as (string | null)[];
        expect(params[3]).toBeNull();
      }
    });

    it('should use explicit column list in RETURNING (not RETURNING *)', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{
          id: 'test-id',
          user_id: 'user-1',
          document_type: 'baa',
          document_version: '0.1',
          ip_address: null,
          user_agent: null,
          accepted_at: new Date(),
        }],
      });

      await recordLegalAcceptances(mockClient as never, 'user-1', null, null);

      const [sql] = mockClient.query.mock.calls[0] as [string];
      expect(sql).not.toContain('RETURNING *');
      expect(sql).toContain('RETURNING');
      expect(sql).toContain('id');
      expect(sql).toContain('document_type');
    });

    // H-12 fix: Verify that empty rows throw
    it('should throw when INSERT RETURNING returns no rows', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await expect(
        recordLegalAcceptances(mockClient as never, 'user-1', null, null)
      ).rejects.toThrow('INSERT RETURNING returned no rows');
    });
  });
});
