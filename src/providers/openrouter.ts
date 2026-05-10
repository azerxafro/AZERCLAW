/**
 * 🐟 AZERCLAW OpenRouter Provider
 * Specialized provider for OpenRouter with free-model filtering.
 */

import { OpenAIProvider } from './openai';
import { ModelInfo } from './base';

export class OpenRouterProvider extends OpenAIProvider {
  override readonly name = 'openrouter';
  override readonly displayName = 'OpenRouter';

  constructor(config: { apiKey: string; baseUrl?: string; defaultModel?: string }) {
    super({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://openrouter.ai/api/v1',
      defaultModel: config.defaultModel || 'google/gemini-flash-1.5-exp:free',
    });
  }

  /**
   * List all models, but filter for FREE models and include availability status.
   */
  override async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://azerclaw.ai',
          'X-Title': 'AZERCLAW',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch OpenRouter models');

      const data = await response.json() as any;
      
      return data.data
        .filter((m: any) => {
          // Filter for free models
          const isFree = parseFloat(m.pricing.prompt) === 0 && parseFloat(m.pricing.completion) === 0;
          return isFree;
        })
        .map((m: any) => ({
          id: m.id,
          name: m.name || m.id,
          provider: this.name,
          contextWindow: m.context_length,
          supportsTools: true, // Most modern free models on OpenRouter support tools
          supportsStreaming: true,
          description: `FREE · ${m.description || ''}`,
          status: 'online', // OpenRouter models in the list are generally online
        }));
    } catch (error) {
      console.error('OpenRouter listModels error:', error);
      return this.getFreeDefaultModels();
    }
  }

  private getFreeDefaultModels(): ModelInfo[] {
    return [
      { id: 'google/gemini-flash-1.5-exp:free', name: 'Gemini 1.5 Flash (Free)', provider: this.name, contextWindow: 1048576, supportsTools: true, supportsStreaming: true },
      { id: 'huggingfaceh4/zephyr-7b-beta:free', name: 'Zephyr 7B Beta (Free)', provider: this.name, contextWindow: 4096, supportsTools: true, supportsStreaming: true },
      { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct (Free)', provider: this.name, contextWindow: 4096, supportsTools: true, supportsStreaming: true },
    ];
  }
}
