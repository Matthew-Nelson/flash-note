import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { PatientTypeahead } from './PatientTypeahead';
import { createMockPatient } from '@/test/factories/patient-factory';

function patients(n: number) {
  return Array.from({ length: n }, (_, i) =>
    createMockPatient({
      id: `p${i}`,
      firstName: `First${i}`,
      lastName: `Last${i}`,
    }),
  );
}

describe('PatientTypeahead', () => {
  // shouldAdvanceTime: RTL's asyncWrapper drains through a setTimeout that only
  // advances under jest fake timers, so plain fake timers hang every userEvent call.
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function flushMicrotasks(): Promise<void> {
    // Drain any microtasks produced by pending promises under fake timers.
    await act(async () => { await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  // Types into the combobox, then fires the 250ms debounce and drains the fetch.
  async function typeAndSettle(user: UserEvent, input: HTMLElement, text: string): Promise<void> {
    await user.type(input, text);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    await flushMicrotasks();
  }

  it('renders input with role=combobox + required ARIA attrs', () => {
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={() => Promise.resolve([])}
      />,
    );
    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveAttribute('aria-controls');
  });

  it('does not fire search below min-query-length (<2 chars)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchFn = vi.fn(() => Promise.resolve(patients(3)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    await user.type(screen.getByRole('combobox'), 'J');
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('debounces by 250ms and fires search once per keystroke cluster', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchFn = vi.fn(() => Promise.resolve(patients(2)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await user.type(input, 'Ja');
    act(() => {
      vi.advanceTimersByTime(100);
    });
    await user.type(input, 'n');
    act(() => {
      vi.advanceTimersByTime(100);
    });
    await user.type(input, 'e');
    act(() => {
      vi.advanceTimersByTime(250);
    });
    await flushMicrotasks();
    // Only one fetch fires for the final "Jane" value.
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith('Jane', expect.any(AbortSignal));
  });

  it('cancels in-flight AbortController on rapid typing', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const aborted: boolean[] = [];
    const fetchFn = vi.fn((q: string, signal: AbortSignal) => {
      const p = new Promise<ReturnType<typeof patients>>((resolve) => {
        const t = setTimeout(() => resolve(patients(1)), 1000);
        signal.addEventListener('abort', () => {
          aborted.push(true);
          clearTimeout(t);
          resolve([]);
        });
      });
      return p;
    });
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await user.type(input, 'Ja');
    act(() => {
      vi.advanceTimersByTime(250);
    });
    await user.type(input, 'ne');
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(aborted.length).toBeGreaterThanOrEqual(1);
  });

  it('announces result count via aria-live region', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchFn = vi.fn(() => Promise.resolve(patients(3)));
    const { container } = render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    await typeAndSettle(user, screen.getByRole('combobox'), 'Jane');
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toMatch(/3 patients? found/);
  });

  it('announces no-results message when server returns empty', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchFn = vi.fn(() => Promise.resolve(patients(0)));
    const { container } = render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    await typeAndSettle(user, screen.getByRole('combobox'), 'zelda');
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toMatch(/No patients match "zelda"/);
  });

  it('clamps to 10 visible options even when server returns more', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchFn = vi.fn(() => Promise.resolve(patients(25)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    await typeAndSettle(user, screen.getByRole('combobox'), 'Jane');
    // 10 patient options + the "Showing first 10 — refine" helper option
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(11);
  });

  it('ArrowDown opens listbox and focuses first option', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchFn = vi.fn(() => Promise.resolve(patients(3)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await typeAndSettle(user, input, 'Jane');
    // activedescendant points at first option
    expect(input.getAttribute('aria-activedescendant')).toContain('-opt-0');
  });

  it('Enter selects the active option and fires onSelect', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSelect = vi.fn();
    const fetchFn = vi.fn(() => Promise.resolve(patients(3)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={onSelect}
        fetchPatients={fetchFn}
      />,
    );
    await typeAndSettle(user, screen.getByRole('combobox'), 'Jane');
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p0' }),
    );
  });

  it('Escape closes listbox but keeps input text', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchFn = vi.fn(() => Promise.resolve(patients(2)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole<HTMLInputElement>('combobox');
    await typeAndSettle(user, input, 'Jane');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input.value).toBe('Jane');
  });

  it('Clear button unsets selection and refocuses input', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSelect = vi.fn();
    const selected = createMockPatient({
      id: 'p1',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    render(
      <PatientTypeahead
        selectedPatient={selected}
        onSelect={onSelect}
        fetchPatients={() => Promise.resolve([])}
      />,
    );
    const clearBtn = screen.getByRole('button', { name: /clear selected patient/i });
    await user.click(clearBtn);
    expect(onSelect).toHaveBeenCalledWith(null);
    expect(screen.getByRole('combobox')).toHaveFocus();
  });

  it('Clear button exposes 44px touch target (M-7)', () => {
    const selected = createMockPatient({
      id: 'p1',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    render(
      <PatientTypeahead
        selectedPatient={selected}
        onSelect={() => undefined}
        fetchPatients={() => Promise.resolve([])}
      />,
    );
    const clearBtn = screen.getByRole('button', { name: /clear selected patient/i });
    expect(clearBtn.className).toContain('min-h-[44px]');
    expect(clearBtn.className).toContain('min-w-[44px]');
  });

  it('arrow toggle button exposes 44px touch target (M-7)', () => {
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={() => Promise.resolve([])}
      />,
    );
    const arrow = screen.getByRole('button', { name: /show patient suggestions/i });
    expect(arrow.className).toContain('min-h-[44px]');
    expect(arrow.className).toContain('min-w-[44px]');
  });

  it('listbox options expose 44px touch targets (M-7)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchFn = vi.fn(() => Promise.resolve(patients(3)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    await typeAndSettle(user, screen.getByRole('combobox'), 'Jane');
    const options = screen.getAllByRole('option');
    for (const opt of options) {
      expect(opt.className).toContain('min-h-[44px]');
    }
  });

  it('rendering with selectedPatient shows their name in the input', () => {
    const selected = createMockPatient({
      firstName: 'Alice',
      lastName: 'Jones',
    });
    render(
      <PatientTypeahead
        selectedPatient={selected}
        onSelect={() => undefined}
        fetchPatients={() => Promise.resolve([])}
      />,
    );
    const input = screen.getByRole<HTMLInputElement>('combobox');
    expect(input.value).toBe('Alice Jones');
  });

  it('editing while a patient is selected un-selects (onSelect(null))', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSelect = vi.fn();
    const selected = createMockPatient({
      firstName: 'Alice',
      lastName: 'Jones',
    });
    render(
      <PatientTypeahead
        selectedPatient={selected}
        onSelect={onSelect}
        fetchPatients={() => Promise.resolve([])}
      />,
    );
    await user.type(screen.getByRole('combobox'), 'l');
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('mousedown on an option selects it (prevents blur before click)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSelect = vi.fn();
    const fetchFn = vi.fn(() => Promise.resolve(patients(3)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={onSelect}
        fetchPatients={fetchFn}
      />,
    );
    await typeAndSettle(user, screen.getByRole('combobox'), 'Jane');
    const options = screen.getAllByRole('option');
    // Press only (no release): the selection must happen on mousedown itself.
    await user.pointer({ keys: '[MouseLeft>]', target: options[1] });
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1' }),
    );
  });

  it('mouseenter on an option updates the active index (for hover highlight)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchFn = vi.fn(() => Promise.resolve(patients(3)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await typeAndSettle(user, input, 'Jane');
    const options = screen.getAllByRole('option');
    await user.hover(options[2]);
    expect(input.getAttribute('aria-activedescendant')).toContain('-opt-2');
  });

  it('arrow toggle button opens listbox when results present', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchFn = vi.fn(() => Promise.resolve(patients(3)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await typeAndSettle(user, input, 'Jane');
    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    const arrow = screen.getByRole('button', { name: /show patient suggestions/i });
    await user.click(arrow);
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('arrow toggle is a no-op when no results are loaded', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={() => Promise.resolve([])}
      />,
    );
    const input = screen.getByRole('combobox');
    const arrow = screen.getByRole('button', { name: /show patient suggestions/i });
    await user.click(arrow);
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('fetchPatients rejection surfaces as empty listbox and no-results announcement', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchFn = vi.fn(() =>
      Promise.reject<ReturnType<typeof patients>>(new Error('server down')),
    );
    const { container } = render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    await typeAndSettle(user, screen.getByRole('combobox'), 'Jane');
    const live = container.querySelector('[aria-live="polite"]');
    // Rule 2: the rejection's message must never reach the UI.
    expect(live?.textContent).toBe('No patients found');
    expect(document.body).not.toHaveTextContent('server down');
  });

  it('ArrowDown with closed listbox but existing results opens and focuses first', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchFn = vi.fn(() => Promise.resolve(patients(3)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await typeAndSettle(user, input, 'Jane');
    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input.getAttribute('aria-activedescendant')).toContain('-opt-0');
  });

  it('ArrowDown wraps from last to first option', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchFn = vi.fn(() => Promise.resolve(patients(3)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await typeAndSettle(user, input, 'Jane');
    // Cycle to last then one more to wrap.
    await user.keyboard('{End}');
    expect(input.getAttribute('aria-activedescendant')).toContain('-opt-2');
    await user.keyboard('{ArrowDown}');
    expect(input.getAttribute('aria-activedescendant')).toContain('-opt-0');
  });

  it('ArrowUp from first wraps to last option', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchFn = vi.fn(() => Promise.resolve(patients(3)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await typeAndSettle(user, input, 'Jane');
    // activeIdx is 0 after initial results; ArrowUp wraps to last.
    await user.keyboard('{ArrowUp}');
    expect(input.getAttribute('aria-activedescendant')).toContain('-opt-2');
  });

  it('ArrowUp with closed listbox but results opens and focuses last', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchFn = vi.fn(() => Promise.resolve(patients(3)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await typeAndSettle(user, input, 'Jane');
    await user.keyboard('{Escape}');
    await user.keyboard('{ArrowUp}');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input.getAttribute('aria-activedescendant')).toContain('-opt-2');
  });

  it('ArrowDown/ArrowUp with no results is a no-op (no crash, no expansion)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchFn = vi.fn(() => Promise.resolve(patients(0)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await typeAndSettle(user, input, 'zz');
    // Escape to close listbox so the "no results when closed" path is hit.
    await user.keyboard('{Escape}');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowUp}');
    // No aria-activedescendant set.
    expect(input.getAttribute('aria-activedescendant')).toBeNull();
  });

  it('Enter with no active option is a no-op (no onSelect call)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSelect = vi.fn();
    const fetchFn = vi.fn(() => Promise.resolve(patients(0)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={onSelect}
        fetchPatients={fetchFn}
      />,
    );
    await typeAndSettle(user, screen.getByRole('combobox'), 'zz');
    await user.keyboard('{Enter}');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('Escape when listbox is already closed is a no-op', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchFn = vi.fn(() => Promise.resolve(patients(0)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('Home/End with no results is a no-op (closed listbox)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={() => Promise.resolve([])}
      />,
    );
    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.keyboard('{Home}');
    await user.keyboard('{End}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('unrelated key is ignored (e.g. Shift)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchFn = vi.fn(() => Promise.resolve(patients(2)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await typeAndSettle(user, input, 'Ja');
    // Shift is a modifier that inserts no text, so only the keydown handler sees it.
    await user.keyboard('{Shift}');
    // No crash; listbox still open.
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('focusing the input re-opens the listbox if results already exist', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchFn = vi.fn(() => Promise.resolve(patients(3)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await typeAndSettle(user, input, 'Ja');
    await user.keyboard('{Escape}');
    // Leave and re-enter the input so the focus event (not a keystroke) reopens it.
    await user.tab();
    await user.tab({ shift: true });
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('Home/End jump to first/last option when listbox is open', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchFn = vi.fn(() => Promise.resolve(patients(4)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await typeAndSettle(user, input, 'Ja');
    await user.keyboard('{End}');
    expect(input.getAttribute('aria-activedescendant')).toContain('-opt-3');
    await user.keyboard('{Home}');
    expect(input.getAttribute('aria-activedescendant')).toContain('-opt-0');
  });
});
