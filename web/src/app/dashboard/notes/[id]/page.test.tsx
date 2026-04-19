import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionData } from '@/server/types';
import type { ClinicalNoteWithPatient, NoteVersionWithSection } from '@/lib/types';

vi.mock('next/navigation', () => ({
  notFound: vi.fn((): never => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirect: vi.fn((): never => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

import { notFound, redirect } from 'next/navigation';

const mockGetSession = vi.hoisted(() => vi.fn());
const mockFindClinicalNoteById = vi.hoisted(() => vi.fn());
const mockFindVersionsByNoteId = vi.hoisted(() => vi.fn());
const mockAuditLog = vi.hoisted(() => vi.fn());
const mockGetRequestContext = vi.hoisted(() => vi.fn());

vi.mock('@/server/lib/get-session', () => ({ getSession: mockGetSession }));
vi.mock('@/server/dal', () => ({
  findClinicalNoteById: mockFindClinicalNoteById,
  findVersionsByNoteId: mockFindVersionsByNoteId,
}));
vi.mock('@/server/services/audit', () => ({
  auditService: { log: mockAuditLog, logWithClient: vi.fn() },
}));
vi.mock('@/server/lib/request-context', () => ({
  getRequestContext: mockGetRequestContext,
}));
vi.mock('@/server/types', () => ({
  AuditAction: {
    NOTE_VIEWED: 'NOTE_VIEWED',
    NOTE_HISTORY_VIEWED: 'NOTE_HISTORY_VIEWED',
  },
}));
vi.mock('@/components/TopBar', () => ({
  TopBar: ({ title }: { title: string }) => <header data-testid="top-bar">{title}</header>,
}));
vi.mock('@/components/notes/ClientNoteDetail', () => ({
  ClientNoteDetail: ({ note }: { note: ClinicalNoteWithPatient }) => (
    <div data-testid="client-note-detail" data-note-id={note.id} />
  ),
}));

import NoteDetailPage from './page';

const NOTE_ID = '55555555-5555-5555-5555-555555555555';

function createMockSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    sessionId: 'session-1',
    userId: 'user-1',
    email: 'test@example.com',
    subscriptionStatus: 'active',
    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    emailVerified: true,
    organizationId: null,
    ...overrides,
  };
}

function createMockNote(): ClinicalNoteWithPatient {
  return {
    id: NOTE_ID,
    userId: 'user-1',
    organizationId: null,
    patientId: null,
    templateId: '00000000-0000-0000-0000-000000000001',
    noteType: 'daily_note',
    content: [],
    quickNotes: '',
    patientContext: null,
    modality: null,
    durationMinutes: null,
    generationTimeMs: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    patientFirstName: null,
    patientLastName: null,
  };
}

describe('NoteDetailPage', () => {
  beforeEach(() => {
    // Preserve the factory impl but reset call counts.
    vi.mocked(redirect).mockClear();
    vi.mocked(notFound).mockClear();
    mockGetSession.mockReset();
    mockFindClinicalNoteById.mockReset();
    mockFindVersionsByNoteId.mockReset();
    mockAuditLog.mockReset();
    mockGetRequestContext.mockReset();

    mockGetRequestContext.mockResolvedValue({ ipAddress: '127.0.0.1', userAgent: 'TestAgent' });
    mockFindClinicalNoteById.mockResolvedValue(createMockNote());
    mockFindVersionsByNoteId.mockResolvedValue([] as NoteVersionWithSection[]);
  });

  it('redirects to /login when no session', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(
      NoteDetailPage({ params: Promise.resolve({ id: NOTE_ID }) }),
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/login?reason=session_expired');
  });

  it('calls notFound when id is not a valid UUID', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    await expect(
      NoteDetailPage({ params: Promise.resolve({ id: 'bad-id' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockFindClinicalNoteById).not.toHaveBeenCalled();
  });

  it('calls notFound when findClinicalNoteById returns null', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    mockFindClinicalNoteById.mockResolvedValue(null);
    await expect(
      NoteDetailPage({ params: Promise.resolve({ id: NOTE_ID }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('calls findClinicalNoteById with scope + noteId (Rule 5)', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    await NoteDetailPage({ params: Promise.resolve({ id: NOTE_ID }) });
    expect(mockFindClinicalNoteById).toHaveBeenCalledWith(
      { type: 'user', userId: 'user-1' },
      NOTE_ID,
    );
  });

  it('calls findVersionsByNoteId (Rule 5)', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    await NoteDetailPage({ params: Promise.resolve({ id: NOTE_ID }) });
    expect(mockFindVersionsByNoteId).toHaveBeenCalledWith(
      { type: 'user', userId: 'user-1' },
      NOTE_ID,
    );
  });

  // B-2: NOTE_VIEWED + NOTE_HISTORY_VIEWED audit verification (mirrors 04-02 PATIENT_VIEWED pattern)

  it('fires NOTE_VIEWED audit event on render (B-2)', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    await NoteDetailPage({ params: Promise.resolve({ id: NOTE_ID }) });
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'NOTE_VIEWED',
        status: 'SUCCESS',
        metadata: expect.objectContaining({ noteId: NOTE_ID }),
      }),
    );
  });

  it('fires NOTE_HISTORY_VIEWED audit event on render (B-2)', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    mockFindVersionsByNoteId.mockResolvedValue([
      {
        id: 'v1',
        noteId: NOTE_ID,
        sectionId: 's1',
        version: 1,
        content: '',
        source: 'generated',
        createdBy: 'user-1',
        createdAt: new Date(),
        sectionTitle: 'Subjective',
      },
    ] as NoteVersionWithSection[]);
    await NoteDetailPage({ params: Promise.resolve({ id: NOTE_ID }) });
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'NOTE_HISTORY_VIEWED',
        metadata: expect.objectContaining({ noteId: NOTE_ID, versionCount: 1 }),
      }),
    );
  });

  it('fires both audit events in a single render call (B-2 verified)', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    await NoteDetailPage({ params: Promise.resolve({ id: NOTE_ID }) });
    expect(mockAuditLog).toHaveBeenCalledTimes(2);
  });
});
