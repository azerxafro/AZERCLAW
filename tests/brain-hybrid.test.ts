import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HybridEngine } from '../src/brain/hybrid';
import { SmartModelRouter } from '../src/brain/router';
import { getRouter } from '../src/providers/router';

// Mock providers so no real network calls are made, but let AgentRuntime run for real
vi.mock('../src/providers/router', () => ({
  getRouter: vi.fn(),
  ProviderRouter: vi.fn(),
  resetRouter: vi.fn(),
}));

describe('HybridEngine', () => {
  let engine: HybridEngine;
  const events: any[] = [];

  beforeEach(() => {
    events.length = 0;
    vi.clearAllMocks();

    // Set up a fake router that returns controlled provider responses
    (getRouter as any).mockReturnValue({
      getProvider: vi.fn().mockImplementation((name: string) => {
        // Default planner returns simple decomposition
        return {
          name: name || 'default',
          complete: vi.fn().mockImplementation(() =>
            new Promise((resolve) =>
              setTimeout(() => resolve({
                content: '{"complexity":"simple","subtasks":[{"id":"1","description":"Test task","taskType":"chat","dependencies":[]}]}',
                finishReason: 'stop',
                model: 'test-model',
                provider: name || 'default',
              }), 50)
            )
          ),
        };
      }),
      complete: vi.fn().mockResolvedValue({
        content: 'Hello from provider',
        finishReason: 'stop',
        model: 'test-model',
        provider: 'test',
      }),
      listAllModels: vi.fn().mockResolvedValue([
        { id: 'test-model', provider: 'test', contextWindow: 128000, supportsTools: true, supportsStreaming: true },
      ]),
    });

    engine = new HybridEngine({
      eventHandler: async (event) => { events.push(event); return; },
    });
  });

  it('should emit decompose event on execute', async () => {
    const result = await engine.execute('Say hello');
    expect(result).toBeDefined();
    expect(events.some(e => e.type === 'decompose')).toBe(true);
  });

  it('should emit done event after execution', async () => {
    const result = await engine.execute('Simple task');
    expect(result).toBeDefined();
    expect(events.some(e => e.type === 'done')).toBe(true);
  });

  it('should return provider response for simple tasks', async () => {
    const result = await engine.execute('What is 2+2?');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should abort in-flight execution', async () => {
    setTimeout(() => engine.abort(), 5);
    const result = await engine.execute('Take your time');
    expect(result).toBe('Execution aborted.');
  });
});
