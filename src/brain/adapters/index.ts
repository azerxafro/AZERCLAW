/**
 * 🐟 AZERCLAW Tool Adapter Registry
 * Maps provider names to their tool-calling adapters.
 */

import { BaseToolAdapter } from './base';
import { PromptInjectionAdapter } from './prompt';
import { NativeToolAdapter } from './native';

const adapterRegistry = new Map<string, BaseToolAdapter>();

// Default: prompt injection for generic / unknown providers
adapterRegistry.set('default', new PromptInjectionAdapter());

// Native tool support (OpenAI-compatible)
adapterRegistry.set('native', new NativeToolAdapter());
adapterRegistry.set('openai', new NativeToolAdapter());
adapterRegistry.set('opencode', new NativeToolAdapter());
adapterRegistry.set('openrouter', new NativeToolAdapter());
adapterRegistry.set('groq', new NativeToolAdapter());
adapterRegistry.set('pollinations', new NativeToolAdapter());
adapterRegistry.set('kiloauto', new NativeToolAdapter()); // OpenAI-compatible
adapterRegistry.set('ollama', new NativeToolAdapter());   // OpenAI-compatible

// Prompt injection for models without native tool support
adapterRegistry.set('huggingface', new PromptInjectionAdapter());
adapterRegistry.set('localllama', new PromptInjectionAdapter());

export function getAdapter(providerName: string): BaseToolAdapter {
  return adapterRegistry.get(providerName) || adapterRegistry.get('default')!;
}

export function registerAdapter(providerName: string, adapter: BaseToolAdapter): void {
  adapterRegistry.set(providerName, adapter);
}

export { BaseToolAdapter, PromptInjectionAdapter, NativeToolAdapter };
