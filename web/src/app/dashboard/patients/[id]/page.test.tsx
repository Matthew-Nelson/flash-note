import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SessionData } from '@/server/types';
import { AuditAction } from '@/server/types';
import { createMockPatient } from '@/test/factories/patient-factory';

// Extend the global next/navigation mock (setup.ts) with `notFound`.
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

import { redirect, notFound } from 'next/navigation';

// Mocks
const mockGetSession = vi.fn<() => Promise<SessionData | null>>();
vi.mock('@/server/lib/get-session', () => ({
  getSession: (): Promise<SessionData | null> => mockGetSession(),
}));

const mockFindPatientById = vi.fn<(scope: unknown, id: string) => Promise<unknown>>();
vi.mock('@/server/dal', () => ({
  findPatientById: (scope: unknown, id: string): Promise<unknown> =>
    mockFindPatientById(scope, id),
}));

const mockAuditLog = vi.hoisted(() =>
  vi.fn<
    (entry: {
      userId: string;
      action: string;
      status: string;
      metadata?: Record<string, unknown>;
    }) => Promise<void>
  >(),
);
vi.mock('@/server/services/audit', () => ({
  auditService: {
    log: mockAuditLog,
    logWithClient: vi.fn(),
  },
}));

vi.mock('@/server/lib/request-context', () => ({
  getRequestContext: () =>
    Promise.resolve({ ipAddress: '1.1.1.1', userAgent: 'ua' }),
}));

vi.mock('@/components/TopBar', () => ({
  TopBar: ({ title }: { title: string }) => (
    <header data-testid="top-bar">{title}</header>
  ),
}));

vi.mock('@/components/patients', () => ({
  ClientPatientDetail: ({
    patient,
    children,
  }: {
    patient: { firstName: string; lastName: string };
    children: React.ReactNode;
  }) => (
    <div
      data-testid="client-patient-detail"
      data-patient={`${patient.firstName} ${patient.lastName}`}
    >
      {children}
    </div>
  ),
  PatientInfoCard: ({ patient }: { patient: { id: string } }) => (
    <div data-testid={`info-${patient.id}`} />
  ),
  PatientContextField: ({ patient }: { patient: { id: string } }) => (
    <div data-testid={`context-${patient.id}`} />
  ),
  PatientNotesTable: ({
    patient,
    notes,
  }: {
    patient: { id: string };
    notes: readonly unknown[];
  }) => (
    <div
      data-testid={`notes-${patient.id}`}
      data-count={notes.length}
    />
  ),
}));

import PatientDetailPage from './page';

function session(overrides: Partial<SessionData> = {}): SessionData {
  return {
    sessionId: 's',
    userId: 'user-1',
    email: 'pt@example.com',
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date('2026-06-01'),
    emailVerified: true,
    organizationId: null,
    ...overrides,
  };
}

const PATIENT_ID = '00000000-0000-0000-0000-000000000001';

describe('PatientDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redirect).mockImplementation((): never => {
      throw new Error('NEXT_REDIRECT');
    });
    vi.mocked(notFound).mockImplementation((): never => {
      throw new Error('NEXT_NOT_FOUND');
    });
    mockAuditLog.mockResolvedValue(undefined);
  });

  it('redirects to /login when unauthenticated (Rule 8)', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(
      PatientDetailPage({ params: Promise.resolve({ id: PATIENT_ID }) }),
    ).rejects.toThrow('NEXT_REDIRECT');
  });

  it('notFound when patientId is not a UUID', async () => {
    mockGetSession.mockResolvedValue(session());
    await expect(
      PatientDetailPage({ params: Promise.resolve({ id: 'not-a-uuid' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockFindPatientById).not.toHaveBeenCalled();
  });

  it('notFound when DAL returns null (Rule 5: out-of-scope / archived)', async () => {
    mockGetSession.mockResolvedValue(session());
    mockFindPatientById.mockResolvedValueOnce(null);
    await expect(
      PatientDetailPage({ params: Promise.resolve({ id: PATIENT_ID }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('fires PATIENT_VIEWED audit with patientId metadata', async () => {
    mockGetSession.mockResolvedValue(session({ userId: 'user-7' }));
    mockFindPatientById.mockResolvedValueOnce(
      createMockPatient({
        id: PATIENT_ID,
        firstName: 'Jane',
        lastName: 'Doe',
      }),
    );
    render(
      await PatientDetailPage({
        params: Promise.resolve({ id: PATIENT_ID }),
      }),
    );
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-7',
        action: AuditAction.PATIENT_VIEWED,
        status: 'SUCCESS',
        metadata: { patientId: PATIENT_ID },
      }),
    );
  });

  it('audit metadata does NOT contain PHI field values', async () => {
    mockGetSession.mockResolvedValue(session());
    mockFindPatientById.mockResolvedValueOnce(
      createMockPatient({
        id: PATIENT_ID,
        firstName: 'SensitiveName',
        lastName: 'SensitiveLast',
        phone: '555-0000',
      }),
    );
    render(
      await PatientDetailPage({
        params: Promise.resolve({ id: PATIENT_ID }),
      }),
    );
    const call = mockAuditLog.mock.calls[0]?.[0];
    const s = JSON.stringify(call?.metadata);
    expect(s).not.toContain('SensitiveName');
    expect(s).not.toContain('SensitiveLast');
    expect(s).not.toContain('555-0000');
  });

  it('renders <main id="main-content"> (Rule 14)', async () => {
    mockGetSession.mockResolvedValue(session());
    mockFindPatientById.mockResolvedValueOnce(
      createMockPatient({
        id: PATIENT_ID,
        firstName: 'Jane',
        lastName: 'Doe',
      }),
    );
    render(
      await PatientDetailPage({
        params: Promise.resolve({ id: PATIENT_ID }),
      }),
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('renders single <h1> with patient full name', async () => {
    mockGetSession.mockResolvedValue(session());
    mockFindPatientById.mockResolvedValueOnce(
      createMockPatient({
        id: PATIENT_ID,
        firstName: 'Jane',
        lastName: 'Doe',
      }),
    );
    const { container } = render(
      await PatientDetailPage({
        params: Promise.resolve({ id: PATIENT_ID }),
      }),
    );
    const h1s = container.querySelectorAll('h1');
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent('Jane Doe');
  });

  it('renders the three section cards: info, context, notes', async () => {
    mockGetSession.mockResolvedValue(session());
    mockFindPatientById.mockResolvedValueOnce(
      createMockPatient({ id: PATIENT_ID }),
    );
    render(
      await PatientDetailPage({
        params: Promise.resolve({ id: PATIENT_ID }),
      }),
    );
    expect(screen.getByTestId(`info-${PATIENT_ID}`)).toBeInTheDocument();
    expect(screen.getByTestId(`context-${PATIENT_ID}`)).toBeInTheDocument();
    const notes = screen.getByTestId(`notes-${PATIENT_ID}`);
    expect(notes).toBeInTheDocument();
    // 04-02 passes notes=[] until 04-03 wires real data.
    expect(notes).toHaveAttribute('data-count', '0');
  });

  it('DAL is called with user scope from session (Rule 5)', async () => {
    mockGetSession.mockResolvedValue(session({ userId: 'alpha' }));
    mockFindPatientById.mockResolvedValueOnce(
      createMockPatient({ id: PATIENT_ID }),
    );
    await PatientDetailPage({
      params: Promise.resolve({ id: PATIENT_ID }),
    });
    expect(mockFindPatientById).toHaveBeenCalledWith(
      { type: 'user', userId: 'alpha' },
      PATIENT_ID,
    );
  });
});
