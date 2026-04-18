import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './ConfirmDialog';

function baseProps(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  return {
    open: true,
    title: 'Archive patient?',
    body: 'This patient will be hidden from your active list.',
    confirmLabel: 'Archive patient',
    cancelLabel: 'Keep patient',
    confirmVariant: 'destructive' as const,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
}

describe('ConfirmDialog', () => {
  afterEach(() => {
    // Ensure body overflow is restored between tests.
    document.body.style.overflow = '';
  });

  it('returns null when open=false', () => {
    const { container } = render(
      <ConfirmDialog {...baseProps({ open: false })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders with role="dialog", aria-modal, and aria-labelledby pointing at title', () => {
    render(<ConfirmDialog {...baseProps()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const labelledby = dialog.getAttribute('aria-labelledby');
    expect(labelledby).toBeTruthy();
    const heading = screen.getByText('Archive patient?');
    expect(heading.id).toBe(labelledby);
  });

  it('renders heading, body, cancel and confirm buttons', () => {
    render(<ConfirmDialog {...baseProps()} />);
    expect(
      screen.getByRole('heading', { name: 'Archive patient?' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('This patient will be hidden from your active list.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Keep patient' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Archive patient' }),
    ).toBeInTheDocument();
  });

  it('initial focus lands on Cancel button (not destructive CTA)', () => {
    render(<ConfirmDialog {...baseProps()} />);
    const cancel = screen.getByRole('button', { name: 'Keep patient' });
    expect(document.activeElement).toBe(cancel);
  });

  it('Escape key calls onCancel when not loading', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps({ onCancel })} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Escape key is ignored while loading', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps({ onCancel, loading: true })} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('backdrop click calls onCancel when not loading', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps({ onCancel })} />);
    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.parentElement;
    expect(backdrop).not.toBeNull();
    await user.click(backdrop!);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('backdrop click is ignored while loading', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps({ onCancel, loading: true })} />);
    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.parentElement!;
    await user.click(backdrop);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('clicking inside the dialog does NOT bubble to backdrop', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps({ onCancel })} />);
    await user.click(screen.getByRole('heading', { name: 'Archive patient?' }));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('Tab focus-trap: shift+Tab on first focusable wraps to last', () => {
    render(<ConfirmDialog {...baseProps()} />);
    const cancel = screen.getByRole('button', { name: 'Keep patient' });
    const confirm = screen.getByRole('button', { name: 'Archive patient' });
    // Cancel is first focusable; shift+Tab should jump to last (confirm).
    cancel.focus();
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirm);
  });

  it('Tab focus-trap: Tab on last focusable wraps to first', () => {
    render(<ConfirmDialog {...baseProps()} />);
    const cancel = screen.getByRole('button', { name: 'Keep patient' });
    const confirm = screen.getByRole('button', { name: 'Archive patient' });
    confirm.focus();
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(cancel);
  });

  it('body overflow is locked while open and restored after unmount', () => {
    document.body.style.overflow = 'auto';
    const { unmount } = render(<ConfirmDialog {...baseProps()} />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('auto');
  });

  it('confirm button click invokes onConfirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...baseProps({ onConfirm })} />);
    await user.click(screen.getByRole('button', { name: 'Archive patient' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders errorMessage with role="alert"', () => {
    render(
      <ConfirmDialog
        {...baseProps({ errorMessage: "We couldn't archive this patient. Please try again." })}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't archive this patient. Please try again.",
    );
  });

  it('aria-live region is rendered unconditionally (Rule 13) — exists while idle', () => {
    const { container } = render(<ConfirmDialog {...baseProps()} />);
    const live = container.querySelector('[aria-live]');
    expect(live).not.toBeNull();
    expect(live).toHaveAttribute('aria-live', 'polite');
  });

  it('aria-live shifts to "assertive" when errorMessage is present', () => {
    const { container } = render(
      <ConfirmDialog {...baseProps({ errorMessage: 'Boom' })} />,
    );
    const live = container.querySelector('[aria-live]');
    expect(live).toHaveAttribute('aria-live', 'assertive');
  });

  it('aria-live announces "Working..." while loading', () => {
    const { container } = render(
      <ConfirmDialog {...baseProps({ loading: true })} />,
    );
    const live = container.querySelector('[aria-live]');
    expect(live?.textContent).toBe('Working...');
  });

  it('aria-live surfaces statusMessage when provided', () => {
    const { container } = render(
      <ConfirmDialog {...baseProps({ statusMessage: 'Patient archived.' })} />,
    );
    const live = container.querySelector('[aria-live]');
    expect(live?.textContent).toBe('Patient archived.');
  });

  it('destructive confirmVariant applies destructive styling to confirm button', () => {
    render(<ConfirmDialog {...baseProps({ confirmVariant: 'destructive' })} />);
    const confirm = screen.getByRole('button', { name: 'Archive patient' });
    expect(confirm.className).toContain('bg-fn-error');
  });

  it('primary confirmVariant uses primary styling', () => {
    render(<ConfirmDialog {...baseProps({ confirmVariant: 'primary', confirmLabel: 'Continue' })} />);
    const confirm = screen.getByRole('button', { name: 'Continue' });
    expect(confirm.className).toContain('btn-primary');
  });

  it('confirm button shows spinner while loading', () => {
    render(<ConfirmDialog {...baseProps({ loading: true })} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    // While loading, the spinner's aria-label combines with the label text, so
    // select by text content instead of accessible name.
    expect(
      screen.getByRole('button', { name: /Archive patient/i }),
    ).toBeDisabled();
  });

  it('cancel button is disabled while loading', () => {
    render(<ConfirmDialog {...baseProps({ loading: true })} />);
    expect(
      screen.getByRole('button', { name: 'Keep patient' }),
    ).toBeDisabled();
  });
});
