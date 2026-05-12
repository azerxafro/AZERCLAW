/**
 * 🐟 AZERCLAW Multi-Provider LLM Router
 * Routes requests to the best available provider.
 */

import { BaseProvider, CompletionOptions, CompletionResult, StreamChunk, ModelInfo } from './base';
import { OpenAIProvider } from './openai';
import { getConfigManager } from '../config/manager';
import { AIConfig, KEYLESS_PROVIDERS, ProviderConfig, ProviderName } from '../config/schema';

interface ProvidersMap {
  opencode: ProviderConfig;
  openai: ProviderConfig;
  anthropic: ProviderConfig;
  google: ProviderConfig;
  groq: ProviderConfig;
  deepseek: ProviderConfig;
  openrouter: ProviderConfig;
  ollama: ProviderConfig;
  lmstudio: ProviderConfig;
  localai: ProviderConfig;
  pollinations: ProviderConfig;
  custom: ProviderConfig;
}

function isKeyless(name: string): boolean {
  return (KEYLESS_PROVIDERS as readonly string[]).includes(name);
}

export class ProviderRouter {
  private providers: Map<string, BaseProvider> = new Map();

  constructor() {
    const config = getConfigManager();
    const aiConfig = config.getAll().ai;
    this.initProviders(aiConfig);
  }

  private initProviders(aiConfig: AIConfig): void {
    const providers = aiConfig.providers as ProvidersMap;

    for (const [name, cfg] of Object.entries(providers) as [keyof ProvidersMap, ProviderConfig][]) {
      if (!cfg || !cfg.enabled) continue;
      // Skip key-required providers without a key, but allow keyless providers
      // (ollama / lmstudio / localai / pollinations) through with no apiKey.
      if (!cfg.apiKey && !isKeyless(name)) continue;
      if (!cfg.baseUrl) continue;

      this.providers.set(name, new OpenAIProvider({
        // OpenAI SDK requires a non-empty apiKey even when the upstream ignores it.
        apiKey: cfg.apiKey || 'no-key-required',
        baseUrl: cfg.baseUrl,
        defaultModel: cfg.defaultModel,
      }));
    }

    if (process.env.AZERCLAW_DEBUG) {
      console.log(`[Router] Initialized providers: ${Array.from(this.providers.keys()).join(', ') || '(none)'}`);
    }
  }

  getProvider(name?: string): BaseProvider | undefined {
    if (name) return this.providers.get(name);
    const config = getConfigManager().getAll();
    const defaultProvider = config.ai.defaultProvider;
    return this.providers.get(defaultProvider)
      || this.providers.get('opencode')
      || this.providers.values().next().value;
  }

  async complete(options: CompletionOptions, preferredProvider?: string): Promise<CompletionResult> {
    const config = getConfigManager().getAll();
    const provider = this.getProvider(preferredProvider);
    if (!provider) {
      return { content: 'Error: No AI engine configured. Run `azerclaw onboard`.', model: 'none', provider: 'none', finishReason: 'error' };
    }

    const providerName = preferredProvider || provider.name || config.ai.defaultProvider;
    const providers = config.ai.providers as ProvidersMap;
    const providerConfig = providers[providerName as keyof ProvidersMap] ?? providers.opencode;
    const defaultModel = providerConfig?.defaultModel;

    const modelFallbacks = ((config.ai as { modelFallbackChain?: string[] }).modelFallbackChain) || [];
    const modelChain = [options.model && options.model !== 'auto' ? options.model : defaultModel, ...modelFallbacks];

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
        finishReason: 'error',
      };
    }

    return {
      content: `Error: All models in the chain failed. Last error: ${lastError}`,
      model: 'none',
      provider: providerName,
      finishReason: 'error',
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

export type { ProviderName };
