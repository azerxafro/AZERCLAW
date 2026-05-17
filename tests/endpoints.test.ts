import { describe, it, expect, vi, afterEach } from 'vitest';
import { VoughtHQ, getVoughtHQ } from '../src/server/hq';
import { WebhookAdapter } from '../src/channels/webhook';
import * as http from 'http';

vi.mock('http', async (importOriginal) => {
  const actual = await importOriginal<typeof http>();
  return {
    ...actual,
    createServer: vi.fn().mockImplementation((handler) => {
      // Track 'listening' handlers so listen() can invoke them synchronously,
      // matching real http.Server.listen() semantics for the WebhookAdapter's
      // Promise-based connect() implementation.
      const listeners: Record<string, ((...args: any[]) => void)[]> = {};
      const register = (event: string, cb: (...args: any[]) => void) => {
        (listeners[event] = listeners[event] || []).push(cb);
      };
      return {
        listen: vi.fn(() => {
          (listeners['listening'] || []).forEach(cb => cb());
        }),
        close: vi.fn((cb?: () => void) => { if (cb) cb(); }),
        on: vi.fn(register),
        once: vi.fn(register),
        removeListener: vi.fn(),
        handler
      };
    })
  };
});

describe('Endpoints and Webhooks', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('VoughtHQ should instantiate and start server', () => {
    const hq = getVoughtHQ();
    expect(hq).toBeInstanceOf(VoughtHQ);
    
    // Attempt to start
    hq.start();
    // VoughtHQ uses express and internal node server, we can verify it doesn't crash
    expect(hq.start).toBeDefined();
    hq.stop();
  });

  it('WebhookAdapter should handle POST requests', async () => {
    const adapter = new WebhookAdapter();
    await adapter.connect({ port: '3141' });
    
    expect(http.createServer).toHaveBeenCalled();
    const serverInstance = (http.createServer as any).mock.results[0].value;
    expect(serverInstance).toBeDefined();
    
    const req = {
      method: 'POST',
      on: vi.fn((event, cb) => {
        if (event === 'data') cb(JSON.stringify({ id: '123', message: 'Hello' }));
        if (event === 'end') cb();
      })
    };
    
    const res = {
      writeHead: vi.fn(),
      end: vi.fn()
    };
    
    // Simulate request
    adapter['handleIncoming'] = vi.fn().mockResolvedValue(undefined);
    await serverInstance.handler(req, res);
    
    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ ok: true }));
  });

  it('WebhookAdapter should reject non-POST requests', async () => {
    const adapter = new WebhookAdapter();
    await adapter.connect({ port: '3141' });
    
    const serverInstance = (http.createServer as any).mock.results[0].value;
    
    const req = { method: 'GET' };
    const res = { writeHead: vi.fn(), end: vi.fn() };
    
    await serverInstance.handler(req, res);
    expect(res.writeHead).toHaveBeenCalledWith(405);
    expect(res.end).toHaveBeenCalledWith('Method not allowed');
  });
});
