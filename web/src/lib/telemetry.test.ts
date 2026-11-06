import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('telemetry client', () => {
  let sendTelemetry: typeof import('./telemetry').sendTelemetry;
  let initClientTelemetry: typeof import('./telemetry').initClientTelemetry;
  let reportErrorBoundary: typeof import('./telemetry').reportErrorBoundary;

  const mockSendBeacon = vi.fn((_url: string, _data: Blob) => true);
  const mockFetch = vi.fn((_url: string, _init: RequestInit) => Promise.resolve(new Response()));
  const mockAddEventListener = vi.fn();

  const originalNavigator = globalThis.navigator;
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;

  function setGlobal(name: 'navigator' | 'window' | 'fetch', value: unknown): void {
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
  }

  /** Decode the JSON payload from the Nth sendBeacon call. */
  async function beaconPayload(callIndex = 0): Promise<Record<string, unknown>> {
    const call = mockSendBeacon.mock.calls[callIndex];
    expect(call).toBeDefined();
    const [, blob] = call;
    return JSON.parse(await blob.text()) as Record<string, unknown>;
  }

  function getListener<E>(type: string): (event: E) => void {
    const call = mockAddEventListener.mock.calls.find((c: unknown[]) => c[0] === type);
    expect(call).toBeDefined();
    return call![1] as (event: E) => void;
  }

  beforeEach(async () => {
    vi.resetModules();
    mockSendBeacon.mockReset().mockReturnValue(true);
    mockFetch.mockReset().mockResolvedValue(new Response());
    mockAddEventListener.mockReset();

    setGlobal('navigator', { sendBeacon: mockSendBeacon });
    setGlobal('window', {
      addEventListener: mockAddEventListener,
      location: { href: 'http://localhost:3000/dashboard' },
    });
    setGlobal('fetch', mockFetch);

    const mod = await import('./telemetry');
    sendTelemetry = mod.sendTelemetry;
    initClientTelemetry = mod.initClientTelemetry;
    reportErrorBoundary = mod.reportErrorBoundary;
  });

  afterEach(() => {
    setGlobal('navigator', originalNavigator);
    setGlobal('window', originalWindow);
    setGlobal('fetch', originalFetch);
  });

  describe('initClientTelemetry', () => {
    it('registers error and unhandledrejection listeners', () => {
      initClientTelemetry();

      const eventTypes = mockAddEventListener.mock.calls.map((c: unknown[]) => c[0]);
      expect(eventTypes).toEqual(['error', 'unhandledrejection']);
    });

    it('is a no-op when window is undefined (server render)', () => {
      setGlobal('window', undefined);

      expect(() => initClientTelemetry()).not.toThrow();
      expect(mockAddEventListener).not.toHaveBeenCalled();
    });

    it('reports an uncaught Error with its message, stack, and page URL', async () => {
      initClientTelemetry();
      const onError = getListener<ErrorEvent>('error');

      const error = new TypeError('x is not a function');
      error.stack = 'TypeError: x is not a function\n    at foo.js:10';
      onError({ message: 'Uncaught TypeError: x is not a function', error } as ErrorEvent);

      expect(mockSendBeacon).toHaveBeenCalledTimes(1);
      expect(mockSendBeacon.mock.calls[0][0]).toBe('/api/telemetry');
      expect(await beaconPayload()).toEqual({
        type: 'unhandled_error',
        message: 'Uncaught TypeError: x is not a function',
        stack: 'TypeError: x is not a function\n    at foo.js:10',
        url: 'http://localhost:3000/dashboard',
      });
    });

    it('omits the stack and uses a fallback message when the error event has neither', async () => {
      initClientTelemetry();
      const onError = getListener<ErrorEvent>('error');

      // Cross-origin script errors arrive with an empty message and a null error.
      onError({ message: '', error: null } as ErrorEvent);

      const payload = await beaconPayload();
      expect(payload.message).toBe('Unknown error');
      expect(payload).not.toHaveProperty('stack');
    });

    it('does not trust a non-Error `error` value for the stack', async () => {
      initClientTelemetry();
      const onError = getListener<ErrorEvent>('error');

      onError({ message: 'boom', error: { stack: 'forged stack' } } as ErrorEvent);

      const payload = await beaconPayload();
      expect(payload.message).toBe('boom');
      expect(payload).not.toHaveProperty('stack');
    });

    it('reports an Error rejection reason with its message and stack', async () => {
      initClientTelemetry();
      const onRejection = getListener<PromiseRejectionEvent>('unhandledrejection');

      const reason = new Error('Promise rejected');
      reason.stack = 'Error: Promise rejected\n    at bar.js:5';
      onRejection({ reason } as PromiseRejectionEvent);

      expect(await beaconPayload()).toEqual({
        type: 'unhandled_rejection',
        message: 'Promise rejected',
        stack: 'Error: Promise rejected\n    at bar.js:5',
        url: 'http://localhost:3000/dashboard',
      });
    });

    it('uses a string rejection reason as the message, without a stack', async () => {
      initClientTelemetry();
      const onRejection = getListener<PromiseRejectionEvent>('unhandledrejection');

      onRejection({ reason: 'network down' } as PromiseRejectionEvent);

      const payload = await beaconPayload();
      expect(payload.message).toBe('network down');
      expect(payload).not.toHaveProperty('stack');
    });

    it('does not serialize arbitrary object rejection reasons (could contain PHI)', async () => {
      initClientTelemetry();
      const onRejection = getListener<PromiseRejectionEvent>('unhandledrejection');

      onRejection({ reason: { patientName: 'Jane Doe' } } as PromiseRejectionEvent);

      const payload = await beaconPayload();
      expect(payload.message).toBe('Unknown rejection');
      expect(JSON.stringify(payload)).not.toContain('Jane Doe');
    });
  });

  describe('sendTelemetry', () => {
    it('sends the payload to /api/telemetry as a JSON Blob via sendBeacon', async () => {
      sendTelemetry({ type: 'unhandled_error', message: 'test error' });

      expect(mockSendBeacon).toHaveBeenCalledTimes(1);
      const [url, blob] = mockSendBeacon.mock.calls[0];
      expect(url).toBe('/api/telemetry');
      expect(blob.type).toBe('application/json');
      expect(await beaconPayload()).toEqual({ type: 'unhandled_error', message: 'test error' });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('falls back to a keepalive fetch POST when sendBeacon is unavailable', () => {
      setGlobal('navigator', {});

      sendTelemetry({ type: 'unhandled_error', message: 'test error' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/telemetry');
      expect(options).toEqual({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'unhandled_error', message: 'test error' }),
        keepalive: true,
      });
    });

    it('falls back to fetch when navigator itself is undefined', () => {
      setGlobal('navigator', undefined);

      sendTelemetry({ type: 'unhandled_error', message: 'x' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('swallows an async fetch rejection', async () => {
      setGlobal('navigator', {});
      const rejection = Promise.reject(new Error('offline'));
      const catchSpy = vi.spyOn(rejection, 'catch');
      mockFetch.mockReturnValue(rejection);

      expect(() => sendTelemetry({ type: 'unhandled_error', message: 'x' })).not.toThrow();
      expect(catchSpy).toHaveBeenCalledTimes(1);
      // The handler the module attached must resolve the rejection, not re-throw it.
      await expect(catchSpy.mock.results[0].value).resolves.toBeUndefined();
    });

    it('does nothing when neither sendBeacon nor fetch is available', () => {
      setGlobal('navigator', {});
      setGlobal('fetch', undefined);

      expect(() => sendTelemetry({ type: 'unhandled_error', message: 'x' })).not.toThrow();
      expect(mockSendBeacon).not.toHaveBeenCalled();
    });

    it('never throws when sendBeacon throws synchronously', () => {
      mockSendBeacon.mockImplementation(() => {
        throw new Error('sendBeacon failed');
      });

      expect(() => sendTelemetry({ type: 'unhandled_error', message: 'test' })).not.toThrow();
    });

    it('never throws when the payload cannot be serialized', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;

      expect(() => sendTelemetry(circular)).not.toThrow();
      expect(mockSendBeacon).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('reportErrorBoundary', () => {
    it('sends type, message, stack, digest, and page URL', async () => {
      const error = new Error('Component render error');
      error.stack = 'Error: Component render error\n    at MyComponent (app.js:42)';

      reportErrorBoundary(error, 'digest-abc');

      expect(await beaconPayload()).toEqual({
        type: 'error_boundary',
        message: 'Component render error',
        stack: 'Error: Component render error\n    at MyComponent (app.js:42)',
        digest: 'digest-abc',
        url: 'http://localhost:3000/dashboard',
      });
    });

    it('omits digest when not provided', async () => {
      reportErrorBoundary(new Error('Render error'));

      const payload = await beaconPayload();
      expect(payload.message).toBe('Render error');
      expect(payload).not.toHaveProperty('digest');
    });

    it('uses a fallback message when the error message is empty', async () => {
      reportErrorBoundary(new Error(''));

      expect((await beaconPayload()).message).toBe('Unknown error boundary error');
    });

    it('omits the URL when window is undefined', async () => {
      setGlobal('window', undefined);

      reportErrorBoundary(new Error('server-side'));

      const payload = await beaconPayload();
      expect(payload.message).toBe('server-side');
      expect(payload).not.toHaveProperty('url');
    });
  });
});
