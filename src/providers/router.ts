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
    const p = aiConfig.providers;

    // Opencode (default free provider)
    if (p.opencode?.enabled && p.opencode.apiKey) {
      this.providers.set('opencode', new OpenAIProvider({
        apiKey: p.opencode.apiKey,
        baseUrl: p.opencode.baseUrl || 'https://opencode.ai/zen/v1',
        defaultModel: p.opencode.defaultModel || 'minimax-m2.5-free'
      }));
    }

    // OpenRouter (free tier access)
    if (p.openrouter?.enabled && p.openrouter.apiKey) {
      this.providers.set('openrouter', new OpenAIProvider({
        apiKey: p.openrouter.apiKey,
        baseUrl: p.openrouter.baseUrl || 'https://openrouter.ai/api/v1',
        defaultModel: p.openrouter.defaultModel || 'deepseek/deepseek-chat:free'
      }));
    }

    // Groq (fast free tier)
    if (p.groq?.enabled && p.groq.apiKey) {
      this.providers.set('groq', new OpenAIProvider({
        apiKey: p.groq.apiKey,
        baseUrl: p.groq.baseUrl || 'https://api.groq.com/openai/v1',
        defaultModel: p.groq.defaultModel || 'llama-3.3-70b-versatile'
      }));
    }

    // Pollinations (no API key needed - completely free)
    if (p.pollinations?.enabled) {
      this.providers.set('pollinations', new OpenAIProvider({
        apiKey: 'pollinations-no-key-required', // Dummy key for compatibility
        baseUrl: p.pollinations.baseUrl || 'https://text.pollinations.ai/openai',
        defaultModel: p.pollinations.defaultModel || 'openai'
      }));
    }

    // Ollama (local models)
    if (p.ollama?.enabled) {
      this.providers.set('ollama', new OpenAIProvider({
        apiKey: 'ollama', // Ollama doesn't need a real API key
        baseUrl: p.ollama.baseUrl || 'http://localhost:11434/v1',
        defaultModel: p.ollama.defaultModel || 'llama3.2'
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
    // Smart fallback: prefer free providers that don't need keys
    return this.providers.get(defaultProvider)
      || this.providers.get('opencode')
      || this.providers.get('pollinations') // No API key needed
      || this.providers.get('openrouter')
      || this.providers.get('groq')
      || this.providers.get('ollama')
      || this.providers.values().next().value;
  }

  /**
   * Get a free provider that doesn't require API key setup
   */
  getFreeProvider(): BaseProvider | undefined {
    // Priority: Pollinations (no key) > OpenRouter free tier > Groq free tier > Ollama
    return this.providers.get('pollinations')
      || this.providers.get('openrouter')
      || this.providers.get('groq')
      || this.providers.get('ollama')
      || this.providers.values().next().value;
  }

  async complete(options: CompletionOptions, preferredProvider?: string): Promise<CompletionResult> {
    const config = getConfigManager().getAll();
    const provider = this.getProvider(preferredProvider);
    if (!provider) {
      return { content: 'Error: No AI engine configured. Run `azerclaw onboard`.', model: 'none', provider: 'none', finishReason: 'error' };
    }

    const providerName = preferredProvider || provider.name || config.ai.defaultProvider;
    const providerConfig = config.ai.providers[providerName as keyof typeof config.ai.providers];
    const defaultModel = providerConfig?.defaultModel;

    const modelChain = [options.model && options.model !== 'auto' ? options.model : defaultModel, ...(config.ai.modelFallbackChain || [])];

    let lastError = '';
    let attempted = false;
    for (const modelId of modelChain) {
      if (!modelId) continue;
      attempted = true;
      if (process.env.AZERCLAW_DEBUG) {
        console.log(`[Router] Attempting model: ${modelId} on ${providerName}...`);
      }
      try {
        const start = Date.now();
        const result = await provider.complete({ ...options, model: modelId });
        if (process.env.AZERCLAW_DEBUG) {
          console.log(`[Router] Model ${modelId} finished in ${Date.now() - start}ms (finishReason: ${result.finishReason})`);
        }
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
