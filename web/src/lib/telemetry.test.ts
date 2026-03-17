import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('telemetry client', () => {
  let sendTelemetry: typeof import('./telemetry').sendTelemetry;
  let initClientTelemetry: typeof import('./telemetry').initClientTelemetry;
  let reportErrorBoundary: typeof import('./telemetry').reportErrorBoundary;

  const mockSendBeacon = vi.fn(() => true);
  const mockFetch = vi.fn(() => Promise.resolve(new Response()));

  beforeEach(async () => {
    vi.resetModules();

    // Set up browser globals
    Object.defineProperty(globalThis, 'navigator', {
      value: { sendBeacon: mockSendBeacon },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(globalThis, 'window', {
      value: {
        addEventListener: vi.fn(),
        location: { href: 'http://localhost:3000/dashboard' },
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(globalThis, 'fetch', {
      value: mockFetch,
      writable: true,
      configurable: true,
    });

    const mod = await import('./telemetry');
    sendTelemetry = mod.sendTelemetry;
    initClientTelemetry = mod.initClientTelemetry;
    reportErrorBoundary = mod.reportErrorBoundary;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockSendBeacon.mockClear();
    mockFetch.mockClear();
  });

  describe('initClientTelemetry', () => {
    it('registers window.onerror and unhandledrejection listeners', () => {
      initClientTelemetry();

      const addEventListenerSpy = globalThis.window.addEventListener as ReturnType<typeof vi.fn>;
      const calls = addEventListenerSpy.mock.calls;
      const eventTypes = calls.map((c: unknown[]) => c[0]);

      expect(eventTypes).toContain('error');
      expect(eventTypes).toContain('unhandledrejection');
    });

    it('sends telemetry when a window error fires', () => {
      initClientTelemetry();

      const addEventListenerSpy = globalThis.window.addEventListener as ReturnType<typeof vi.fn>;
      const errorHandler = addEventListenerSpy.mock.calls.find(
        (c: unknown[]) => c[0] === 'error'
      )?.[1] as (event: ErrorEvent) => void;

      expect(errorHandler).toBeDefined();

      // Simulate an error event
      const errorEvent = {
        message: 'Uncaught TypeError: x is not a function',
        error: {
          stack: 'TypeError: x is not a function\n    at foo.js:10',
        },
      } as ErrorEvent;

      errorHandler(errorEvent);

      expect(mockSendBeacon).toHaveBeenCalledTimes(1);
      const [url, blob] = mockSendBeacon.mock.calls[0] as unknown as [string, Blob];
      expect(url).toBe('/api/telemetry');

      // sendBeacon receives a Blob, so we check it was called
      expect(blob).toBeInstanceOf(Blob);
    });

    it('sends telemetry when an unhandled rejection fires', () => {
      initClientTelemetry();

      const addEventListenerSpy = globalThis.window.addEventListener as ReturnType<typeof vi.fn>;
      const rejectionHandler = addEventListenerSpy.mock.calls.find(
        (c: unknown[]) => c[0] === 'unhandledrejection'
      )?.[1] as (event: PromiseRejectionEvent) => void;

      expect(rejectionHandler).toBeDefined();

      const rejectionEvent = {
        reason: new Error('Promise rejected'),
      } as PromiseRejectionEvent;

      rejectionHandler(rejectionEvent);

      expect(mockSendBeacon).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendTelemetry', () => {
    it('uses sendBeacon with a JSON Blob', () => {
      const payload = { type: 'unhandled_error', message: 'test error' };
      sendTelemetry(payload);

      expect(mockSendBeacon).toHaveBeenCalledTimes(1);
      const [url, blob] = mockSendBeacon.mock.calls[0] as unknown as [string, Blob];
      expect(url).toBe('/api/telemetry');
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/json');
    });

    it('falls back to fetch with keepalive when sendBeacon is unavailable', () => {
      // Remove sendBeacon
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        writable: true,
        configurable: true,
      });

      const payload = { type: 'unhandled_error', message: 'test error' };
      sendTelemetry(payload);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe('/api/telemetry');
      expect(options.method).toBe('POST');
      expect(options.keepalive).toBe(true);
      expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
    });

    it('never throws even if sendBeacon and fetch both fail', () => {
      mockSendBeacon.mockImplementation(() => {
        throw new Error('sendBeacon failed');
      });
      mockFetch.mockImplementation(() => {
        throw new Error('fetch failed');
      });

      // Should not throw
      expect(() => {
        sendTelemetry({ type: 'unhandled_error', message: 'test' });
      }).not.toThrow();
    });
  });

  describe('reportErrorBoundary', () => {
    it('sends a payload with type error_boundary, message, stack, and digest', () => {
      const error = new Error('Component render error');
      error.stack = 'Error: Component render error\n    at MyComponent (app.js:42)';

      reportErrorBoundary(error, 'digest-abc');

      expect(mockSendBeacon).toHaveBeenCalledTimes(1);
      const [, blob] = mockSendBeacon.mock.calls[0] as unknown as [string, Blob];
      expect(blob).toBeInstanceOf(Blob);
    });

    it('sends without digest when not provided', () => {
      const error = new Error('Render error');

      reportErrorBoundary(error);

      expect(mockSendBeacon).toHaveBeenCalledTimes(1);
    });
  });
});
