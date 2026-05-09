/**
 * 🐟 AZERCLAW Configuration Schema
 * Defines the full configuration structure with Zod validation.
 */

import { z } from 'zod';

// ─── Provider Schemas ───────────────────────────────────────────

const OpenAIProviderSchema = z.object({
  apiKey: z.string().default(''),
  baseUrl: z.string().default('https://api.openai.com/v1'),
  defaultModel: z.string().default('gpt-4o'),
  enabled: z.boolean().default(false),
});

const AnthropicProviderSchema = z.object({
  apiKey: z.string().default(''),
  baseUrl: z.string().default('https://api.anthropic.com'),
  defaultModel: z.string().default('claude-sonnet-4-20250514'),
  enabled: z.boolean().default(false),
});

const GoogleProviderSchema = z.object({
  apiKey: z.string().default(''),
  defaultModel: z.string().default('gemini-2.5-flash'),
  enabled: z.boolean().default(false),
});

const OllamaProviderSchema = z.object({
  baseUrl: z.string().default('http://localhost:11434'),
  defaultModel: z.string().default('llama3.1'),
  enabled: z.boolean().default(false),
});

const GroqProviderSchema = z.object({
  apiKey: z.string().default(''),
  baseUrl: z.string().default('https://api.groq.com/openai/v1'),
  defaultModel: z.string().default('llama-3.3-70b-versatile'),
  enabled: z.boolean().default(false),
});

const DeepSeekProviderSchema = z.object({
  apiKey: z.string().default(''),
  baseUrl: z.string().default('https://api.deepseek.com'),
  defaultModel: z.string().default('deepseek-chat'),
  enabled: z.boolean().default(false),
});

const OpenRouterProviderSchema = z.object({
  apiKey: z.string().default(''),
  baseUrl: z.string().default('https://openrouter.ai/api/v1'),
  defaultModel: z.string().default('anthropic/claude-sonnet-4'),
  enabled: z.boolean().default(false),
});

const CustomProviderSchema = z.object({
  apiKey: z.string().default(''),
  baseUrl: z.string().default(''),
  defaultModel: z.string().default(''),
  enabled: z.boolean().default(false),
});

// ─── AI Config ──────────────────────────────────────────────────

const ProvidersSchema = z.object({
  openai: OpenAIProviderSchema,
  anthropic: AnthropicProviderSchema,
  google: GoogleProviderSchema,
  ollama: OllamaProviderSchema,
  groq: GroqProviderSchema,
  deepseek: DeepSeekProviderSchema,
  openrouter: OpenRouterProviderSchema,
  custom: CustomProviderSchema,
}).default(() => ({
  openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', enabled: false },
  anthropic: { apiKey: '', baseUrl: 'https://api.anthropic.com', defaultModel: 'claude-sonnet-4-20250514', enabled: false },
  google: { apiKey: '', defaultModel: 'gemini-2.5-flash', enabled: false },
  ollama: { baseUrl: 'http://localhost:11434', defaultModel: 'llama3.1', enabled: false },
  groq: { apiKey: '', baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile', enabled: false },
  deepseek: { apiKey: '', baseUrl: 'https://api.deepseek.com', defaultModel: 'deepseek-chat', enabled: false },
  openrouter: { apiKey: '', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'anthropic/claude-sonnet-4', enabled: false },
  custom: { apiKey: '', baseUrl: '', defaultModel: '', enabled: false },
}));

const AIConfigSchema = z.object({
  defaultProvider: z.string().default('openai'),
  fallbackChain: z.array(z.string()).default(['openai', 'anthropic', 'google']),
  maxTokens: z.number().default(4096),
  temperature: z.number().default(0.7),
  providers: ProvidersSchema,
});

// ─── Agent Config ───────────────────────────────────────────────

const AgentConfigSchema = z.object({
  name: z.string().default('Azerclaw'),
  personality: z.string().default('helpful, precise, and proactive'),
  maxIterations: z.number().default(25),
  approvalRequired: z.boolean().default(true),
  allowShellCommands: z.boolean().default(true),
  allowFileWrite: z.boolean().default(true),
  allowNetworkAccess: z.boolean().default(true),
  sandboxMode: z.boolean().default(false),
});

// ─── UI Config ──────────────────────────────────────────────────

const UIConfigSchema = z.object({
  theme: z.enum(['dark', 'light', 'ocean', 'neon']).default('ocean'),
  showSplash: z.boolean().default(true),
  animationSpeed: z.enum(['slow', 'normal', 'fast', 'none']).default('normal'),
  colorMode: z.enum(['auto', 'ansi256', 'truecolor', 'none']).default('auto'),
});

// ─── Channels Config ──────────────────────────────────────────────

const ChannelsConfigSchema = z.object({
  discord: z.object({ token: z.string().default(''), enabled: z.boolean().default(false) }),
  telegram: z.object({ token: z.string().default(''), enabled: z.boolean().default(false) }),
  slack: z.object({ token: z.string().default(''), enabled: z.boolean().default(false) }),
}).default(() => ({
  discord: { token: '', enabled: false },
  telegram: { token: '', enabled: false },
  slack: { token: '', enabled: false },
}));

// ─── Full Config ────────────────────────────────────────────────

export const ConfigSchema = z.object({
  ai: AIConfigSchema.default(() => ({
    defaultProvider: 'openai',
    fallbackChain: ['openai', 'anthropic', 'google'],
    maxTokens: 4096,
    temperature: 0.7,
    providers: {
      openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', enabled: false },
      anthropic: { apiKey: '', baseUrl: 'https://api.anthropic.com', defaultModel: 'claude-sonnet-4-20250514', enabled: false },
      google: { apiKey: '', defaultModel: 'gemini-2.5-flash', enabled: false },
      ollama: { baseUrl: 'http://localhost:11434', defaultModel: 'llama3.1', enabled: false },
      groq: { apiKey: '', baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile', enabled: false },
      deepseek: { apiKey: '', baseUrl: 'https://api.deepseek.com', defaultModel: 'deepseek-chat', enabled: false },
      openrouter: { apiKey: '', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'anthropic/claude-sonnet-4', enabled: false },
      custom: { apiKey: '', baseUrl: '', defaultModel: '', enabled: false },
    },
  })),
  agent: AgentConfigSchema.default(() => ({
    name: 'Azerclaw',
    personality: 'helpful, precise, and proactive',
    maxIterations: 25,
    approvalRequired: true,
    allowShellCommands: true,
    allowFileWrite: true,
    allowNetworkAccess: true,
    sandboxMode: false,
  })),
  ui: UIConfigSchema.default(() => ({
    theme: 'ocean' as const,
    showSplash: true,
    animationSpeed: 'normal' as const,
    colorMode: 'auto' as const,
  })),
  channels: ChannelsConfigSchema.default(() => ({
    discord: { token: '', enabled: false },
    telegram: { token: '', enabled: false },
    slack: { token: '', enabled: false },
  })),
  version: z.string().default('1.0.0'),
  firstRun: z.boolean().default(true),
});

export type AzerclawConfig = z.infer<typeof ConfigSchema>;
export type AIConfig = z.infer<typeof AIConfigSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type UIConfig = z.infer<typeof UIConfigSchema>;

// Provider type exports
export type ProviderName = 'openai' | 'anthropic' | 'google' | 'ollama' | 'groq' | 'deepseek' | 'openrouter' | 'custom';
