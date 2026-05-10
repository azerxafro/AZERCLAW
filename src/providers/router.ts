/**
 * 🐟 AZERCLAW Multi-Provider LLM Router
 * Routes requests to the best available provider with automatic fallback.
 */

import { BaseProvider, CompletionOptions, CompletionResult, StreamChunk, ModelInfo } from './base';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { GoogleProvider } from './google';
import { OllamaProvider } from './ollama';
import { OpenRouterProvider } from './openrouter';
import { getConfigManager } from '../config/manager';
import { ProviderName } from '../config/schema';

export class ProviderRouter {
  private providers: Map<string, BaseProvider> = new Map();
  private fallbackChain: string[];

  constructor() {
    const config = getConfigManager();
    const aiConfig = config.getAll().ai;
    this.fallbackChain = aiConfig.fallbackChain;
    this.initProviders(aiConfig);
  }

  private initProviders(aiConfig: any): void {
    const p = aiConfig.providers;
    if (p.openai.enabled && p.openai.apiKey) {
      this.providers.set('openai', new OpenAIProvider(p.openai));
    }
    if (p.anthropic.enabled && p.anthropic.apiKey) {
      this.providers.set('anthropic', new AnthropicProvider(p.anthropic));
    }
    if (p.google.enabled && p.google.apiKey) {
      this.providers.set('google', new GoogleProvider(p.google));
    }
    if (p.ollama.enabled) {
      this.providers.set('ollama', new OllamaProvider(p.ollama));
    }
    if (p.lmstudio?.enabled) {
      // LM Studio exposes an OpenAI-compatible API on localhost:1234
      this.providers.set('lmstudio', new OpenAIProvider({
        apiKey: 'lm-studio',
        baseUrl: p.lmstudio.baseUrl || 'http://localhost:1234/v1',
        defaultModel: p.lmstudio.defaultModel || 'local-model',
      }));
    }
    if (p.localai?.enabled) {
      // LocalAI exposes an OpenAI-compatible API
      this.providers.set('localai', new OpenAIProvider({
        apiKey: 'local-ai',
        baseUrl: p.localai.baseUrl || 'http://localhost:8080/v1',
        defaultModel: p.localai.defaultModel || 'local-model',
      }));
    }
    if (p.groq.enabled && p.groq.apiKey) {
      // Groq uses OpenAI-compatible API
      this.providers.set('groq', new OpenAIProvider({ apiKey: p.groq.apiKey, baseUrl: p.groq.baseUrl, defaultModel: p.groq.defaultModel }));
    }
    if (p.deepseek.enabled && p.deepseek.apiKey) {
      this.providers.set('deepseek', new OpenAIProvider({ apiKey: p.deepseek.apiKey, baseUrl: p.deepseek.baseUrl, defaultModel: p.deepseek.defaultModel }));
    }
    if (p.openrouter.enabled && p.openrouter.apiKey) {
      this.providers.set('openrouter', new OpenRouterProvider({ apiKey: p.openrouter.apiKey, baseUrl: p.openrouter.baseUrl, defaultModel: p.openrouter.defaultModel }));
    }
    if (p.custom.enabled && p.custom.apiKey && p.custom.baseUrl) {
      this.providers.set('custom', new OpenAIProvider({ apiKey: p.custom.apiKey, baseUrl: p.custom.baseUrl, defaultModel: p.custom.defaultModel }));
    }
  }

  getProvider(name?: string): BaseProvider | undefined {
    if (name) return this.providers.get(name);
    const config = getConfigManager();
    const defaultProvider = config.getAll().ai.defaultProvider;
    return this.providers.get(defaultProvider) || this.providers.values().next().value;
  }

  async complete(options: CompletionOptions, preferredProvider?: string): Promise<CompletionResult> {
    // Build the resolution order: preferred → default → fallback chain → any available
    const config = getConfigManager();
    const defaultProvider = config.getAll().ai.defaultProvider;
    
    const tried = new Set<string>();
    const tryOrder: string[] = [];
    let lastError = '';
    
    if (preferredProvider) tryOrder.push(preferredProvider);
    if (defaultProvider) tryOrder.push(defaultProvider);
    tryOrder.push(...this.fallbackChain);
    // Add all registered providers as final fallback
    for (const name of this.providers.keys()) tryOrder.push(name);

    for (const providerName of tryOrder) {
      if (tried.has(providerName)) continue;
      tried.add(providerName);
      
      const provider = this.providers.get(providerName);
      if (!provider) continue;
      
      // Retry with exponential backoff for transient errors
      const maxRetries = 3;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const result = await provider.complete(options);
          if (result.finishReason !== 'error') return result;
          
          // Check if error is retryable (rate limit, server error)
          const isRetryable = result.content.includes('429') || 
                              result.content.includes('500') || 
                              result.content.includes('502') || 
                              result.content.includes('503') ||
                              result.content.includes('rate') ||
                              result.content.includes('timeout');
          
          if (isRetryable && attempt < maxRetries - 1) {
            const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          
          lastError = result.content || `${providerName} returned error`;
          break;
        } catch (e: any) {
          const isRetryable = e.status === 429 || e.status >= 500 || 
                              e.code === 'ECONNREFUSED' || e.code === 'ETIMEDOUT' ||
                              e.code === 'ENOTFOUND';
          
          if (isRetryable && attempt < maxRetries - 1) {
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          
          lastError = e.message || `${providerName} threw exception`;
          break;
        }
      }
    }

    const errorMsg = lastError 
      ? `Error: All providers failed. Last error: ${lastError}`
      : 'Error: No providers available. Run `azerclaw onboard` to configure.';
    return { content: errorMsg, model: 'none', provider: 'none', finishReason: 'error' };
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
