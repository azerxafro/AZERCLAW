/**
 * 🐟 AZERCLAW Multi-Provider LLM Router
 * Routes requests to the best available provider.
 */

import { BaseProvider, CompletionOptions, CompletionResult, StreamChunk, ModelInfo } from './base';
import { OpenAIProvider } from './openai';
import { getConfigManager } from '../config/manager';
import { AIConfig } from '../config/schema';

export class ProviderRouter {
  private providers: Map<string, BaseProvider> = new Map();

  constructor() {
    const config = getConfigManager();
    const aiConfig = config.getAll().ai;
    this.initProviders(aiConfig);
  }

  private initProviders(aiConfig: AIConfig): void {
    const p = aiConfig.providers as Record<string, any>;
    
    if (p.opencode && p.opencode.enabled && p.opencode.apiKey) {
      this.providers.set('opencode', new OpenAIProvider({
        apiKey: p.opencode.apiKey,
        baseUrl: p.opencode.baseUrl || 'https://opencode.ai/zen/v1',
        defaultModel: p.opencode.defaultModel || 'minimax-m2.5-free'
      }));
    }

    if (process.env.AZERCLAW_DEBUG) {
      console.log(`[Router] Initialized providers: ${Array.from(this.providers.keys()).join(', ')}`);
    }
  }

  getProvider(name?: string): BaseProvider | undefined {
    if (name) return this.providers.get(name);
    const config = getConfigManager().getAll();
    const defaultProvider = config.ai.defaultProvider;
    return this.providers.get(defaultProvider) || this.providers.get('opencode') || this.providers.values().next().value;
  }

  async complete(options: CompletionOptions, preferredProvider?: string): Promise<CompletionResult> {
    const config = getConfigManager().getAll();
    const provider = this.getProvider(preferredProvider);
    if (!provider) {
      return { content: 'Error: No AI engine configured. Run `azerclaw onboard`.', model: 'none', provider: 'none', finishReason: 'error' };
    }

    const providerName = preferredProvider || (provider as BaseProvider).name || config.ai.defaultProvider;
    const providerConfig = (config.ai.providers as Record<string, any>)[providerName] || (config.ai.providers as Record<string, any>).opencode;
    const defaultModel = providerConfig?.defaultModel;
    
    const modelChain = [options.model && options.model !== 'auto' ? options.model : defaultModel, ...((config.ai as Record<string, any>).modelFallbackChain || [])];

    let lastError = '';
    let attempted = false;
    for (const modelId of modelChain) {
      if (!modelId) continue;
      attempted = true;
      if (process.env.AZERCLAW_DEBUG) {
        console.log(`[Router] Attempting model: ${modelId} on ${providerName}`);
      }
      try {
        const result = await provider.complete({ ...options, model: modelId });
        if (result.finishReason !== 'error') return result;
        lastError = result.content;
      } catch (e: unknown) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    }

    if (!attempted) {
      return {
        content: 'Error: No model configured. Run `azerclaw config model <model-id>` or `azerclaw onboard`.',
        model: 'none',
        provider: providerName,
        finishReason: 'error'
      };
    }

    return { 
      content: `Error: All models in the chain failed. Last error: ${lastError}`, 
      model: 'none', 
      provider: providerName, 
      finishReason: 'error' 
    };
  }

  async *stream(options: CompletionOptions, preferredProvider?: string): AsyncGenerator<StreamChunk> {
    const provider = preferredProvider ? this.providers.get(preferredProvider) : this.getProvider();
    if (!provider) { yield { type: 'error', error: 'No provider available' }; return; }
    yield* provider.stream(options);
  }

  async listAllModels(): Promise<ModelInfo[]> {
    const allModels: ModelInfo[] = [];
    for (const [, provider] of this.providers) {
      try {
        const models = await provider.listModels();
        allModels.push(...models);
      } catch { /* skip */ }
    }
    return allModels;
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  hasAnyProvider(): boolean {
    return this.providers.size > 0;
  }
}

let routerInstance: ProviderRouter | null = null;
export function getRouter(): ProviderRouter {
  if (!routerInstance) routerInstance = new ProviderRouter();
  return routerInstance;
}
export function resetRouter(): void { routerInstance = null; }
