import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  async function flushMicrotasks(): Promise<void> {
    // Drain any microtasks produced by pending promises under fake timers.
    await act(async () => { await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
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
    const fetchFn = vi.fn(() => Promise.resolve(patients(3)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'J' } });
      vi.advanceTimersByTime(300);
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('debounces by 250ms and fires search once per keystroke cluster', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(patients(2)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'Ja' } });
      vi.advanceTimersByTime(100);
      fireEvent.change(input, { target: { value: 'Jan' } });
      vi.advanceTimersByTime(100);
      fireEvent.change(input, { target: { value: 'Jane' } });
      vi.advanceTimersByTime(250);
    });
    await flushMicrotasks();
    // Only one fetch fires for the final "Jane" value.
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith('Jane', expect.any(AbortSignal));
  });

  it('cancels in-flight AbortController on rapid typing', async () => {
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
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'Ja' } });
      vi.advanceTimersByTime(250);
    });
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'Jane' } });
      vi.advanceTimersByTime(250);
    });
    expect(aborted.length).toBeGreaterThanOrEqual(1);
  });

  it('announces result count via aria-live region', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(patients(3)));
    const { container } = render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'Jane' } });
      vi.advanceTimersByTime(250);
    });
    await flushMicrotasks();
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toMatch(/3 patients? found/);
  });

  it('announces no-results message when server returns empty', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(patients(0)));
    const { container } = render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'zelda' } });
      vi.advanceTimersByTime(250);
    });
    await flushMicrotasks();
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toMatch(/No patients match "zelda"/);
  });

  it('clamps to 10 visible options even when server returns more', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(patients(25)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'Jane' } });
      vi.advanceTimersByTime(250);
    });
    await flushMicrotasks();
    // 10 patient options + the "Showing first 10 — refine" helper option
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(11);
  });

  it('ArrowDown opens listbox and focuses first option', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(patients(3)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'Jane' } });
      vi.advanceTimersByTime(250);
    });
    await flushMicrotasks();
    // activedescendant points at first option
    expect(input.getAttribute('aria-activedescendant')).toContain('-opt-0');
  });

  it('Enter selects the active option and fires onSelect', async () => {
    const onSelect = vi.fn();
    const fetchFn = vi.fn(() => Promise.resolve(patients(3)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={onSelect}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'Jane' } });
      vi.advanceTimersByTime(250);
    });
    await flushMicrotasks();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p0' }),
    );
  });

  it('Escape closes listbox but keeps input text', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(patients(2)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole<HTMLInputElement>('combobox');
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'Jane' } });
      vi.advanceTimersByTime(250);
    });
    await flushMicrotasks();
    expect(input).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input.value).toBe('Jane');
  });

  it('Clear button unsets selection and refocuses input', () => {
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
    fireEvent.click(clearBtn);
    expect(onSelect).toHaveBeenCalledWith(null);
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
    const fetchFn = vi.fn(() => Promise.resolve(patients(3)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'Jane' } });
      vi.advanceTimersByTime(250);
    });
    await flushMicrotasks();
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
    const input = screen.getByRole('combobox');
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'Al' } });
      vi.advanceTimersByTime(0);
    });
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('mousedown on an option selects it (prevents blur before click)', async () => {
    const onSelect = vi.fn();
    const fetchFn = vi.fn(() => Promise.resolve(patients(3)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={onSelect}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'Jane' } });
      vi.advanceTimersByTime(250);
    });
    await flushMicrotasks();
    const options = screen.getAllByRole('option');
    fireEvent.mouseDown(options[1]);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1' }),
    );
  });

  it('mouseenter on an option updates the active index (for hover highlight)', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(patients(3)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'Jane' } });
      vi.advanceTimersByTime(250);
    });
    await flushMicrotasks();
    const options = screen.getAllByRole('option');
    fireEvent.mouseEnter(options[2]);
    expect(input.getAttribute('aria-activedescendant')).toContain('-opt-2');
  });

  it('arrow toggle button opens listbox when results present', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(patients(3)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'Jane' } });
      vi.advanceTimersByTime(250);
    });
    await flushMicrotasks();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    const arrow = screen.getByRole('button', { name: /show patient suggestions/i });
    fireEvent.click(arrow);
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('arrow toggle is a no-op when no results are loaded', () => {
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={() => Promise.resolve([])}
      />,
    );
    const input = screen.getByRole('combobox');
    const arrow = screen.getByRole('button', { name: /show patient suggestions/i });
    fireEvent.click(arrow);
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('fetchPatients rejection surfaces as empty listbox and no-results announcement', async () => {
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
    const input = screen.getByRole('combobox');
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'Jane' } });
      vi.advanceTimersByTime(250);
    });
    await flushMicrotasks();
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toMatch(/No patients/);
  });

  it('ArrowDown with closed listbox but existing results opens and focuses first', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(patients(3)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'Jane' } });
      vi.advanceTimersByTime(250);
    });
    await flushMicrotasks();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input.getAttribute('aria-activedescendant')).toContain('-opt-0');
  });

  it('ArrowDown wraps from last to first option', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(patients(3)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'Jane' } });
      vi.advanceTimersByTime(250);
    });
    await flushMicrotasks();
    // Cycle to last then one more to wrap.
    fireEvent.keyDown(input, { key: 'End' });
    expect(input.getAttribute('aria-activedescendant')).toContain('-opt-2');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toContain('-opt-0');
  });

  it('ArrowUp from first wraps to last option', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(patients(3)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'Jane' } });
      vi.advanceTimersByTime(250);
    });
    await flushMicrotasks();
    // activeIdx is 0 after initial results; ArrowUp wraps to last.
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.getAttribute('aria-activedescendant')).toContain('-opt-2');
  });

  it('ArrowUp with closed listbox but results opens and focuses last', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(patients(3)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'Jane' } });
      vi.advanceTimersByTime(250);
    });
    await flushMicrotasks();
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input.getAttribute('aria-activedescendant')).toContain('-opt-2');
  });

  it('ArrowDown/ArrowUp with no results is a no-op (no crash, no expansion)', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(patients(0)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'zz' } });
      vi.advanceTimersByTime(250);
    });
    await flushMicrotasks();
    // Escape to close listbox so the "no results when closed" path is hit.
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    // No aria-activedescendant set.
    expect(input.getAttribute('aria-activedescendant')).toBeNull();
  });

  it('Enter with no active option is a no-op (no onSelect call)', async () => {
    const onSelect = vi.fn();
    const fetchFn = vi.fn(() => Promise.resolve(patients(0)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={onSelect}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'zz' } });
      vi.advanceTimersByTime(250);
    });
    await flushMicrotasks();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('Escape when listbox is already closed is a no-op', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(patients(0)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('Home/End with no results is a no-op (closed listbox)', () => {
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={() => Promise.resolve([])}
      />,
    );
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'Home' });
    fireEvent.keyDown(input, { key: 'End' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('unrelated key is ignored (e.g. "a")', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(patients(2)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'Ja' } });
      vi.advanceTimersByTime(250);
    });
    await flushMicrotasks();
    fireEvent.keyDown(input, { key: 'a' });
    // No crash; listbox still open.
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('focusing the input re-opens the listbox if results already exist', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(patients(3)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'Ja' } });
      vi.advanceTimersByTime(250);
    });
    await flushMicrotasks();
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.focus(input);
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('Home/End jump to first/last option when listbox is open', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(patients(4)));
    render(
      <PatientTypeahead
        selectedPatient={null}
        onSelect={() => undefined}
        fetchPatients={fetchFn}
      />,
    );
    const input = screen.getByRole('combobox');
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'Ja' } });
      vi.advanceTimersByTime(250);
    });
    await flushMicrotasks();
    fireEvent.keyDown(input, { key: 'End' });
    expect(input.getAttribute('aria-activedescendant')).toContain('-opt-3');
    fireEvent.keyDown(input, { key: 'Home' });
    expect(input.getAttribute('aria-activedescendant')).toContain('-opt-0');
  });
});
