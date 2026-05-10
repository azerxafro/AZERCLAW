/**
 * 🐟 AZERCLAW Vought Gate Provider
 * Specialized provider for the secure Cloudflare proxy.
 */

import { OpenAIProvider } from './openai';
import { ModelInfo } from './base';

export class VoughtGateProvider extends OpenAIProvider {
  override readonly name = 'custom';
  override readonly displayName = 'Vought Gate';

  constructor(config: { apiKey: string; baseUrl?: string; defaultModel?: string }) {
    super({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://vought-gate.achu-ashwin98.workers.dev',
      defaultModel: config.defaultModel || '@cf/moonshotai/kimi-k2.6',
    });
  }

  /**
   * Return the whitelisted free models available via the Vought Gate.
   */
  override async listModels(): Promise<ModelInfo[]> {
    return [
      { id: '@cf/moonshotai/kimi-k2.6', name: 'Kimi K2.6 (Azertron X1.0)', provider: this.name, contextWindow: 128000, supportsTools: true, supportsStreaming: true, description: 'FREE · Elite coding and reasoning' },
      { id: '@cf/meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', provider: this.name, contextWindow: 8192, supportsTools: true, supportsStreaming: true, description: 'FREE · Fast and reliable' },
      { id: '@cf/meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', provider: this.name, contextWindow: 8192, supportsTools: true, supportsStreaming: true, description: 'FREE · High performance general purpose' },
      { id: '@cf/mistralai/mistral-7b-instruct-v0.3', name: 'Mistral 7B v0.3', provider: this.name, contextWindow: 32768, supportsTools: true, supportsStreaming: true, description: 'FREE · Efficient instruction following' },
      { id: '@cf/google/gemma-7b-it', name: 'Gemma 7B', provider: this.name, contextWindow: 8192, supportsTools: true, supportsStreaming: true, description: 'FREE · Google’s lightweight model' },
      { id: '@cf/qwen/qwen1.5-7b-chat', name: 'Qwen 1.5 7B', provider: this.name, contextWindow: 32768, supportsTools: true, supportsStreaming: true, description: 'FREE · Strong chat performance' },
      { id: '@cf/microsoft/phi-2', name: 'Phi-2', provider: this.name, contextWindow: 2048, supportsTools: false, supportsStreaming: true, description: 'FREE · Ultra-compact and fast' },
    ];
  }
}
