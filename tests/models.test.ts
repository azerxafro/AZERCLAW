import { describe, it, expect, vi, beforeEach } from 'vitest';
import { modelsStatus, modelsList } from '../src/cli/commands/models';
import * as manager from '../src/config/manager';
import * as router from '../src/providers/router';
import * as fish from '../src/cli/animations/fish';

vi.mock('../src/config/manager', () => ({
  getConfigManager: vi.fn(),
}));

vi.mock('../src/providers/router', () => ({
  getRouter: vi.fn(),
  resetRouter: vi.fn(),
}));

vi.mock('../src/cli/animations/fish', () => ({
  fishBox: vi.fn(),
  fishSuccess: vi.fn(),
  fishInfo: vi.fn(),
  FishThinkingAnimation: class {
    start = vi.fn();
    stop = vi.fn();
  }
}));

describe('Models CLI Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('modelsStatus should display current config', async () => {
    (manager.getConfigManager as any).mockReturnValue({
      getAll: () => ({
        ai: {
          defaultProvider: 'openai',
          providers: {
            openai: { defaultModel: 'gpt-4' }
          },
          fallbackChain: ['openai', 'anthropic'],
          temperature: 0.7,
          maxTokens: 1000,
        }
      })
    });

    await modelsStatus();

    expect(fish.fishBox).toHaveBeenCalled();
    const args = (fish.fishBox as any).mock.calls[0];
    expect(args[0]).toBe('🧠 Model Status');
    expect(args[1].some((line: string) => line.includes('openai'))).toBe(true);
  });

  it('modelsList should fetch and display models', async () => {
    const mockModels = [
      { id: 'free-model', provider: 'ollama', description: 'FREE LOCAL' },
      { id: 'paid-model', provider: 'openai', description: '$$$' }
    ];

    (router.getRouter as any).mockReturnValue({
      listAllModels: vi.fn().mockResolvedValue(mockModels)
    });

    await modelsList();

    expect(router.getRouter().listAllModels).toHaveBeenCalled();
    // It filters and prints to console.log directly
  });
});
