import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SmartModelRouter, classifyTask } from '../src/brain/router';
import { ProviderRouter } from '../src/providers/router';

vi.mock('../src/providers/router', () => ({
  ProviderRouter: vi.fn(),
  getRouter: vi.fn(),
  resetRouter: vi.fn(),
}));

describe('classifyTask', () => {
  it('should classify code tasks', () => {
    expect(classifyTask('Write a function to sort an array')).toBe('code');
    expect(classifyTask('Fix the bug in this script')).toBe('code');
  });

  it('should classify reasoning tasks', () => {
    expect(classifyTask('Explain why the sky is blue')).toBe('reasoning');
    expect(classifyTask('Analyze the trade-offs of this approach')).toBe('reasoning');
  });

  it('should classify search tasks', () => {
    expect(classifyTask('Search the web for Python tutorials')).toBe('search');
    expect(classifyTask('Look up the weather in Tokyo')).toBe('search');
  });

  it('should classify creative tasks', () => {
    expect(classifyTask('Write a short story about a fish')).toBe('creative');
    expect(classifyTask('Design a logo concept')).toBe('creative');
  });

  it('should default to chat for ambiguous input', () => {
    expect(classifyTask('Hello there')).toBe('chat');
    expect(classifyTask('How are you?')).toBe('chat');
  });
});

describe('SmartModelRouter', () => {
  let mockBaseRouter: any;
  let router: SmartModelRouter;

  beforeEach(() => {
    mockBaseRouter = {
      listAllModels: vi.fn().mockResolvedValue([
        { id: 'gpt-4', provider: 'opencode', contextWindow: 128000, supportsTools: true, supportsStreaming: true },
        { id: 'llama-3', provider: 'groq', contextWindow: 128000, supportsTools: true, supportsStreaming: true },
        { id: 'phi-3', provider: 'huggingface', contextWindow: 32000, supportsTools: false, supportsStreaming: false },
        { id: 'local-llama', provider: 'localllama', contextWindow: 128000, supportsTools: false, supportsStreaming: true },
      ]),
      getProvider: vi.fn((name: string) => {
        if (name === 'opencode') return { name: 'opencode', complete: vi.fn() };
        if (name === 'groq') return { name: 'groq', complete: vi.fn() };
        if (name === 'huggingface') return { name: 'huggingface', complete: vi.fn() };
        if (name === 'localllama') return { name: 'localllama', complete: vi.fn() };
        return undefined;
      }),
    };
    router = new SmartModelRouter(mockBaseRouter);
  });

  it('should rank models by task type', async () => {
    const ranked = await router.rankModels({ task: 'code' });
    expect(ranked.length).toBeGreaterThan(0);
    // opencode and groq are strong at code; they should outrank huggingface
    const topProviders = ranked.slice(0, 2).map(r => r.provider);
    expect(topProviders).toContain('opencode');
  });

  it('should prefer tool-supporting models when requireTools is true', async () => {
    const ranked = await router.rankModels({ task: 'code', requireTools: true });
    const nonToolModels = ranked.filter(r => !r.model.supportsTools);
    expect(nonToolModels.length).toBe(0);
  });

  it('should select the best model', async () => {
    const best = await router.selectBest({ task: 'code' });
    expect(best).toBeDefined();
    expect(best!.provider).toBeDefined();
  });

  it('should select top K models for parallel execution', async () => {
    const selected = await router.selectParallel({ task: 'code', topK: 2 });
    expect(selected.length).toBeLessThanOrEqual(2);
    expect(selected.length).toBeGreaterThan(0);
  });

  it('should return undefined when no models available', async () => {
    mockBaseRouter.listAllModels.mockResolvedValue([]);
    const best = await router.selectBest({ task: 'code' });
    expect(best).toBeUndefined();
  });

  it('should return error result when no provider available', async () => {
    mockBaseRouter.listAllModels.mockResolvedValue([]);
    const result = await router.complete({ messages: [{ role: 'user', content: 'Hello' }] });
    expect(result.finishReason).toBe('error');
  });
});
