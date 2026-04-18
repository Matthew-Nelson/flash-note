import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { redirect } from 'next/navigation';
import type { SessionData } from '@/server/types';
import { createMockPatient } from '@/test/factories/patient-factory';

// Mocks
const mockGetSession = vi.fn<() => Promise<SessionData | null>>();
vi.mock('@/server/lib/get-session', () => ({
  getSession: (): Promise<SessionData | null> => mockGetSession(),
}));

const mockFindPatientsByScope =
  vi.fn<
    (
      scope: unknown,
      input?: unknown,
    ) => Promise<{ patients: unknown[]; total: number }>
  >();
vi.mock('@/server/dal', () => ({
  findPatientsByScope: (
    scope: unknown,
    input?: unknown,
  ): Promise<{ patients: unknown[]; total: number }> =>
    mockFindPatientsByScope(scope, input),
}));

vi.mock('@/components/TopBar', () => ({
  TopBar: ({ title }: { title: string }) => (
    <header data-testid="top-bar">
      <span>{title}</span>
    </header>
  ),
}));

// The real SearchPatients and PatientRow are Client Components; avoid Next's
// client-only runtime in a Server Component test by swapping them for stubs.
vi.mock('@/components/patients', () => ({
  SearchPatients: ({ initialQuery }: { initialQuery: string }) => (
    <div data-testid="search-patients" data-query={initialQuery} />
  ),
  PatientRow: ({ patient }: { patient: { id: string; firstName: string; lastName: string } }) => (
    <tr data-testid={`patient-row-${patient.id}`}>
      <td>
        {patient.firstName} {patient.lastName}
      </td>
    </tr>
  ),
}));

import PatientsPage from './page';

function session(overrides: Partial<SessionData> = {}): SessionData {
  return {
    sessionId: 'sess',
    userId: 'user-1',
    email: 'pt@example.com',
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date('2026-06-01'),
    emailVerified: true,
    organizationId: null,
    ...overrides,
  };
}

describe('PatientsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redirect).mockImplementation((): never => {
      throw new Error('NEXT_REDIRECT');
    });
    mockFindPatientsByScope.mockResolvedValue({ patients: [], total: 0 });
  });

  it('redirects to /login when unauthenticated (Rule 8)', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(
      PatientsPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/login?reason=session_expired');
  });

  it('renders <main id="main-content"> (Rule 14)', async () => {
    mockGetSession.mockResolvedValue(session());
    render(await PatientsPage({ searchParams: Promise.resolve({}) }));
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');
  });

  it('renders exactly one <h1> with "Patients"', async () => {
    mockGetSession.mockResolvedValue(session());
    const { container } = render(
      await PatientsPage({ searchParams: Promise.resolve({}) }),
    );
    const h1s = container.querySelectorAll('h1');
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent('Patients');
  });

  it('calls DAL with user scope from session', async () => {
    mockGetSession.mockResolvedValue(session({ userId: 'abc' }));
    await PatientsPage({ searchParams: Promise.resolve({}) });
    expect(mockFindPatientsByScope).toHaveBeenCalledWith(
      { type: 'user', userId: 'abc' },
      expect.objectContaining({ limit: 50, offset: 0 }),
    );
  });

  it('renders empty state when no patients AND no search query', async () => {
    mockGetSession.mockResolvedValue(session());
    mockFindPatientsByScope.mockResolvedValueOnce({ patients: [], total: 0 });
    render(await PatientsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'No patients yet',
    );
    expect(
      screen.getByText(/Create your first patient/i),
    ).toBeInTheDocument();
    // "Add patient" CTA appears in empty state (plus the page header).
    expect(
      screen.getAllByRole('link', { name: /add patient/i }).length,
    ).toBeGreaterThan(0);
  });

  it('renders search-scoped empty state when query yields no results', async () => {
    mockGetSession.mockResolvedValue(session());
    mockFindPatientsByScope.mockResolvedValueOnce({ patients: [], total: 0 });
    render(
      await PatientsPage({ searchParams: Promise.resolve({ q: 'zelda' }) }),
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'No patients match "zelda"',
    );
  });

  it('passes q to DAL and SearchPatients', async () => {
    mockGetSession.mockResolvedValue(session());
    render(
      await PatientsPage({ searchParams: Promise.resolve({ q: 'doe' }) }),
    );
    expect(mockFindPatientsByScope).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ search: 'doe' }),
    );
    expect(screen.getByTestId('search-patients')).toHaveAttribute(
      'data-query',
      'doe',
    );
  });

  it('renders PatientRow for each patient', async () => {
    mockGetSession.mockResolvedValue(session());
    mockFindPatientsByScope.mockResolvedValueOnce({
      patients: [
        createMockPatient({ id: 'p1', firstName: 'Jane', lastName: 'Doe' }),
        createMockPatient({ id: 'p2', firstName: 'John', lastName: 'Smith' }),
      ],
      total: 2,
    });
    render(await PatientsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId('patient-row-p1')).toBeInTheDocument();
    expect(screen.getByTestId('patient-row-p2')).toBeInTheDocument();
  });

  it('pagination renders when total > PAGE_SIZE', async () => {
    mockGetSession.mockResolvedValue(session());
    mockFindPatientsByScope.mockResolvedValueOnce({
      patients: Array.from({ length: 50 }, (_, i) =>
        createMockPatient({
          id: `p${i}`,
          firstName: `First${i}`,
          lastName: `Last${i}`,
        }),
      ),
      total: 125,
    });
    render(
      await PatientsPage({ searchParams: Promise.resolve({ page: '2' }) }),
    );
    expect(
      screen.getByRole('navigation', { name: /pagination/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('no pagination when total fits on one page', async () => {
    mockGetSession.mockResolvedValue(session());
    mockFindPatientsByScope.mockResolvedValueOnce({
      patients: [
        createMockPatient({ id: 'p1', firstName: 'Jane', lastName: 'Doe' }),
      ],
      total: 1,
    });
    render(await PatientsPage({ searchParams: Promise.resolve({}) }));
    expect(
      screen.queryByRole('navigation', { name: /pagination/i }),
    ).not.toBeInTheDocument();
  });

  it('page offset is computed from the page query param', async () => {
    mockGetSession.mockResolvedValue(session());
    await PatientsPage({ searchParams: Promise.resolve({ page: '3' }) });
    expect(mockFindPatientsByScope).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ limit: 50, offset: 100 }),
    );
  });

  it('non-numeric page param falls back to 1 (offset 0)', async () => {
    mockGetSession.mockResolvedValue(session());
    await PatientsPage({
      searchParams: Promise.resolve({ page: 'banana' }),
    });
    expect(mockFindPatientsByScope).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ offset: 0 }),
    );
  });
});
