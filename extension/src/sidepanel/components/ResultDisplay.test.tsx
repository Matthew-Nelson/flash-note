import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResultDisplay from './ResultDisplay';
import { createMockGeneratedNote } from '@/test/helpers';

describe('ResultDisplay', () => {
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render all SOAP sections', () => {
    const note = createMockGeneratedNote();
    render(<ResultDisplay note={note} onBack={onBack} />);

    expect(screen.getByText('SUBJECTIVE:')).toBeInTheDocument();
    expect(screen.getByText('OBJECTIVE:')).toBeInTheDocument();
    expect(screen.getByText('ASSESSMENT:')).toBeInTheDocument();
    expect(screen.getByText('PLAN:')).toBeInTheDocument();
    expect(screen.getByText(note.subjective)).toBeInTheDocument();
  });

  it('should call onBack when Back button is clicked', async () => {
    const user = userEvent.setup();
    render(<ResultDisplay note={createMockGeneratedNote()} onBack={onBack} />);

    await user.click(screen.getByText('Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('should copy all sections to clipboard', async () => {
    // Spy on actual clipboard API (jsdom may or may not provide one)
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      });
    } else {
      vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
      writeTextMock.mockImplementation((...args: [string]) =>
        navigator.clipboard.writeText(...args)
      );
    }

    const user = userEvent.setup();
    const note = createMockGeneratedNote();
    render(<ResultDisplay note={note} onBack={onBack} />);

    await user.click(screen.getByText('Copy All'));

    // copyAll fires async, wait for the UI to update to "Copied!"
    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });

    // Verify the clipboard was called with the full note text
    const clipboardSpy = vi.mocked(navigator.clipboard.writeText);
    expect(clipboardSpy).toHaveBeenCalledWith(
      expect.stringContaining('SUBJECTIVE:')
    );
    expect(clipboardSpy).toHaveBeenCalledWith(
      expect.stringContaining(note.subjective)
    );
  });

  it('should show error message when clipboard copy fails', async () => {
    // Mock clipboard to reject
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockRejectedValue(new Error('Clipboard denied')) },
        writable: true,
        configurable: true,
      });
    } else {
      vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
        new Error('Clipboard denied')
      );
    }

    const user = userEvent.setup();
    render(<ResultDisplay note={createMockGeneratedNote()} onBack={onBack} />);

    await user.click(screen.getByText('Copy All'));

    await waitFor(() => {
      expect(
        screen.getByText('Failed to copy — please try again or manually select the text')
      ).toBeInTheDocument();
    });

    // "Copied!" should NOT appear
    expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
  });

  it('should handle non-Error clipboard failures gracefully', async () => {
    // Mock clipboard to reject with a non-Error value (covers Sentry wrapping branch)
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockRejectedValue('string rejection') },
        writable: true,
        configurable: true,
      });
    } else {
      vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue('string rejection');
    }

    const user = userEvent.setup();
    render(<ResultDisplay note={createMockGeneratedNote()} onBack={onBack} />);

    await user.click(screen.getByText('Copy All'));

    await waitFor(() => {
      expect(
        screen.getByText('Failed to copy — please try again or manually select the text')
      ).toBeInTheDocument();
    });
  });

  it('should auto-dismiss copy error after 3 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    if (!navigator.clipboard) {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockRejectedValue(new Error('Clipboard denied')) },
        writable: true,
        configurable: true,
      });
    } else {
      vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
        new Error('Clipboard denied')
      );
    }

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ResultDisplay note={createMockGeneratedNote()} onBack={onBack} />);

    await user.click(screen.getByText('Copy All'));

    await waitFor(() => {
      expect(screen.getByText(/Failed to copy/)).toBeInTheDocument();
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(screen.queryByText(/Failed to copy/)).not.toBeInTheDocument();
    });
  });

  it('should display generation time when metadata is present', () => {
    const note = createMockGeneratedNote({
      metadata: { generationTimeMs: 2345 },
    });
    render(<ResultDisplay note={note} onBack={onBack} />);

    expect(screen.getByText('Generated in 2.3s')).toBeInTheDocument();
  });

  it('should NOT display generation time when metadata is absent', () => {
    const note = createMockGeneratedNote({ metadata: undefined });
    render(<ResultDisplay note={note} onBack={onBack} />);

    expect(screen.queryByText(/Generated in/)).not.toBeInTheDocument();
  });

  describe('clipboard auto-clear (M-12)', () => {
    it('should schedule clipboard clear 60s after copy', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      if (!navigator.clipboard) {
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText: writeTextMock },
          writable: true,
          configurable: true,
        });
      } else {
        vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
      }

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<ResultDisplay note={createMockGeneratedNote()} onBack={onBack} />);

      await user.click(screen.getByText('Copy All'));

      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });

      const clipboardSpy = vi.mocked(navigator.clipboard.writeText);
      const callCountAfterCopy = clipboardSpy.mock.calls.length;

      // Advance 60 seconds
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });

      // Should have been called again to clear clipboard
      expect(clipboardSpy.mock.calls.length).toBeGreaterThan(callCountAfterCopy);
      // The clear call should pass empty string
      const lastCall = clipboardSpy.mock.calls[clipboardSpy.mock.calls.length - 1];
      expect(lastCall[0]).toBe('');
    });

    it('should cancel clipboard clear timer on unmount', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      if (!navigator.clipboard) {
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText: writeTextMock },
          writable: true,
          configurable: true,
        });
      } else {
        vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
      }

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { unmount } = render(<ResultDisplay note={createMockGeneratedNote()} onBack={onBack} />);

      await user.click(screen.getByText('Copy All'));

      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });

      const clipboardSpy = vi.mocked(navigator.clipboard.writeText);
      const callCountAfterCopy = clipboardSpy.mock.calls.length;

      unmount();

      // Advance 60 seconds — timer should have been cleared
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });

      // No additional clipboard calls should have been made
      expect(clipboardSpy.mock.calls.length).toBe(callCountAfterCopy);
    });
  });
});
