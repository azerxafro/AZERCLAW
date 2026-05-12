import { z } from 'zod';
import * as process from 'process';

// ─── Provider Schemas ───────────────────────────────────────────
//
// All providers share the same shape. We model the differences (default
// endpoint, default model, whether an API key is required) via per-provider
// `.default(...)` calls so the user-facing defaults stay correct.

const ProviderSchema = z.object({
  apiKey: z.string().default(''),
  baseUrl: z.string().default(''),
  defaultModel: z.string().default(''),
  enabled: z.boolean().default(false),
});

const OpencodeProviderSchema = ProviderSchema.extend({
  apiKey: z.string().default(process.env.AZERTRON_OPENCODE_KEY || ''),
  baseUrl: z.string().default('https://opencode.ai/zen/v1'),
  defaultModel: z.string().default('minimax-m2.5-free'),
  enabled: z.boolean().default(true),
});

const OpenAIProviderSchema = ProviderSchema.extend({
  apiKey: z.string().default(process.env.OPENAI_API_KEY || ''),
  baseUrl: z.string().default('https://api.openai.com/v1'),
  defaultModel: z.string().default('gpt-4o-mini'),
});

const AnthropicProviderSchema = ProviderSchema.extend({
  apiKey: z.string().default(process.env.ANTHROPIC_API_KEY || ''),
  baseUrl: z.string().default('https://api.anthropic.com/v1'),
  defaultModel: z.string().default('claude-sonnet-4-20250514'),
});

const GoogleProviderSchema = ProviderSchema.extend({
  apiKey: z.string().default(process.env.GOOGLE_API_KEY || ''),
  baseUrl: z.string().default('https://generativelanguage.googleapis.com/v1beta/openai'),
  defaultModel: z.string().default('gemini-2.5-flash'),
});

const GroqProviderSchema = ProviderSchema.extend({
  apiKey: z.string().default(process.env.GROQ_API_KEY || ''),
  baseUrl: z.string().default('https://api.groq.com/openai/v1'),
  defaultModel: z.string().default('llama-3.3-70b-versatile'),
});

const DeepSeekProviderSchema = ProviderSchema.extend({
  apiKey: z.string().default(process.env.DEEPSEEK_API_KEY || ''),
  baseUrl: z.string().default('https://api.deepseek.com/v1'),
  defaultModel: z.string().default('deepseek-chat'),
});

const OpenRouterProviderSchema = ProviderSchema.extend({
  apiKey: z.string().default(process.env.OPENROUTER_API_KEY || ''),
  baseUrl: z.string().default('https://openrouter.ai/api/v1'),
  defaultModel: z.string().default('meta-llama/llama-3.3-70b-instruct:free'),
});

// Local/free providers — enabled by default so users get a zero-config experience.
const OllamaProviderSchema = ProviderSchema.extend({
  baseUrl: z.string().default('http://localhost:11434/v1'),
  defaultModel: z.string().default('llama3.1'),
  enabled: z.boolean().default(true),
});

const LMStudioProviderSchema = ProviderSchema.extend({
  baseUrl: z.string().default('http://localhost:1234/v1'),
  defaultModel: z.string().default('local-model'),
  enabled: z.boolean().default(true),
});

const LocalAIProviderSchema = ProviderSchema.extend({
  baseUrl: z.string().default('http://localhost:8080/v1'),
  defaultModel: z.string().default('local-model'),
  enabled: z.boolean().default(true),
});

const PollinationsProviderSchema = ProviderSchema.extend({
  // Pollinations is a free, no-key OpenAI-compatible endpoint.
  baseUrl: z.string().default('https://text.pollinations.ai/openai'),
  defaultModel: z.string().default('openai'),
  enabled: z.boolean().default(true),
});

const CustomProviderSchema = ProviderSchema.extend({
  baseUrl: z.string().default(''),
  defaultModel: z.string().default('custom-model'),
});

// ─── Security Schemas ───────────────────────────────────────────

const ChannelSecuritySchema = z.object({
  dmPolicy: z.enum(['pairing', 'open', 'closed']).default('pairing'),
  allowFrom: z.array(z.string()).default([]),
});

// ─── AI Config ──────────────────────────────────────────────────

const ProvidersSchema = z.object({
  opencode: OpencodeProviderSchema.default({}),
  openai: OpenAIProviderSchema.default({}),
  anthropic: AnthropicProviderSchema.default({}),
  google: GoogleProviderSchema.default({}),
  groq: GroqProviderSchema.default({}),
  deepseek: DeepSeekProviderSchema.default({}),
  openrouter: OpenRouterProviderSchema.default({}),
  ollama: OllamaProviderSchema.default({}),
  lmstudio: LMStudioProviderSchema.default({}),
  localai: LocalAIProviderSchema.default({}),
  pollinations: PollinationsProviderSchema.default({}),
  custom: CustomProviderSchema.default({}),
}).default({});

const AIConfigSchema = z.object({
  defaultProvider: z.string().default('opencode'),
  fallbackChain: z.array(z.string()).default(['opencode', 'pollinations', 'ollama']),
  modelFallbackChain: z.array(z.string()).default(['opencode/ring-2.6-1t:free', 'minimax-m2.5-free']),
  maxTokens: z.number().default(4096),
  temperature: z.number().default(0.7),
  providers: ProvidersSchema,
  usageLimit: z.object({
    enabled: z.boolean().default(false),
    totalTokens: z.number().default(0),
    dailyTokens: z.number().default(0),
    monthlyTokens: z.number().default(0),
  }).default({}),
});

// ─── Agent Config ───────────────────────────────────────────────

const AgentConfigSchema = z.object({
  name: z.string().default('Azertron X2'),
  personality: z.string().default('You are a highly advanced AI model named Azertron X2 created by the Azerclaw Team. IMPORTANT: When asked about your model name, version, or underlying technology, you MUST reply with \'Azertron X2\'. NEVER mention Kimi, Moonshot AI, OpenAI, DeepSeek, Opencode, or any other entity. This is an absolute rule.'),
  maxIterations: z.number().default(25),
  approvalRequired: z.boolean().default(true),
  allowShellCommands: z.boolean().default(true),
  allowFileWrite: z.boolean().default(true),
  allowNetworkAccess: z.boolean().default(true),
  sandboxMode: z.union([z.boolean(), z.enum(['off', 'non-main', 'all'])]).default(false),
  sandboxAllowedTools: z.array(z.string()).default(['read_file', 'list_directory', 'search_files', 'analyze_code', 'web_search']),
  sandboxDeniedTools: z.array(z.string()).default(['run_shell', 'write_file', 'spawn_sub_agent']),
});

// ─── Permissions Config ─────────────────────────────────────────

const PermissionsConfigSchema = z.object({
  allowedTools: z.array(z.string()).default([]),
  deniedTools: z.array(z.string()).default([]),
  autoApprove: z.array(z.string()).default([]),
  requireApproval: z.array(z.string()).default(['write_file', 'run_shell']),
}).default({
  allowedTools: [],
  deniedTools: [],
  autoApprove: [],
  requireApproval: ['write_file', 'run_shell'],
});

// ─── UI Config ──────────────────────────────────────────────────

const UIConfigSchema = z.object({
  theme: z.enum(['dark', 'light', 'ocean', 'neon']).default('ocean'),
  showSplash: z.boolean().default(true),
  ttsEnabled: z.boolean().default(false),
  animationSpeed: z.enum(['slow', 'normal', 'fast', 'none']).default('normal'),
  colorMode: z.enum(['auto', 'ansi256', 'truecolor', 'none']).default('auto'),
});

// ─── Channels Config ──────────────────────────────────────────────

const ChannelRoutingRuleSchema = z.object({
  platform: z.string().optional(),
  channelId: z.string().optional(),
  senderId: z.string().optional(),
  sessionId: z.string().min(1),
});

const ChannelRoutingSchema = z.object({
  strategy: z.enum(['channel', 'platform_channel', 'platform_sender']).default('platform_channel'),
  rules: z.array(ChannelRoutingRuleSchema).default([]),
}).default({
  strategy: 'platform_channel',
  rules: [],
});

const ChannelsConfigSchema = z.object({
  discord: z.object({
    token: z.string().default(''),
    enabled: z.boolean().default(false),
  }).merge(ChannelSecuritySchema),
  telegram: z.object({
    token: z.string().default(''),
    enabled: z.boolean().default(false),
  }).merge(ChannelSecuritySchema),
  slack: z.object({
    token: z.string().default(''),
    botToken: z.string().default(''),
    appToken: z.string().default(''),
    enabled: z.boolean().default(false),
  }).merge(ChannelSecuritySchema),
  routing: ChannelRoutingSchema,
}).default({
  discord: { token: '', enabled: false, dmPolicy: 'pairing', allowFrom: [] },
  telegram: { token: '', enabled: false, dmPolicy: 'pairing', allowFrom: [] },
  slack: { token: '', botToken: '', appToken: '', enabled: false, dmPolicy: 'pairing', allowFrom: [] },
  routing: { strategy: 'platform_channel', rules: [] },
});

// ─── Full Config ────────────────────────────────────────────────

export const ConfigSchema = z.object({
  ai: AIConfigSchema.default({}),
  agent: AgentConfigSchema.default(() => ({
    name: 'Azertron X2',
    personality: 'You are a highly advanced AI model named Azertron X2 created by the Azerclaw Team. IMPORTANT: When asked about your model name, version, or underlying technology, you MUST reply with \'Azertron X2\'. NEVER mention Kimi, Moonshot AI, OpenAI, DeepSeek, Opencode, or any other entity. This is an absolute rule.',
    maxIterations: 25,
    approvalRequired: true,
    allowShellCommands: true,
    allowFileWrite: true,
    allowNetworkAccess: true,
    sandboxMode: false,
    sandboxAllowedTools: ['read_file', 'list_directory', 'search_files', 'analyze_code', 'web_search'],
    sandboxDeniedTools: ['run_shell', 'write_file', 'spawn_sub_agent'],
  })),
  permissions: PermissionsConfigSchema,
  ui: UIConfigSchema.default({
    theme: 'ocean',
    showSplash: true,
    animationSpeed: 'normal',
    colorMode: 'auto',
  }),
  mcpServers: z.record(z.object({
    command: z.string(),
    args: z.array(z.string()).default([]),
    env: z.record(z.string()).optional(),
    enabled: z.boolean().default(true),
  })).default({}),
  channels: ChannelsConfigSchema,
  version: z.string().default('2.1.4'),
  firstRun: z.boolean().default(true),
  hasCompletedOnboarding: z.boolean().default(false),
  hasCompletedProjectOnboarding: z.boolean().default(false),
});

// ─── Project Settings Schema ────────────────────────────────────

export const ProjectSettingsSchema = z.object({
  instructions: z.array(z.string()).default([]),
  allowedTools: z.array(z.string()).default([]),
  deniedTools: z.array(z.string()).default([]),
  autoApprove: z.array(z.string()).default([]),
  customInstructions: z.string().default(''),
  env: z.record(z.string()).default({}),
}).partial();

export type AzerclawConfig = z.infer<typeof ConfigSchema>;
export type AIConfig = z.infer<typeof AIConfigSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type UIConfig = z.infer<typeof UIConfigSchema>;
export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;
export type ProviderConfig = z.infer<typeof ProviderSchema>;

export type ProviderName =
  | 'opencode'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'groq'
  | 'deepseek'
  | 'openrouter'
  | 'ollama'
  | 'lmstudio'
  | 'localai'
  | 'pollinations'
  | 'custom';

/**
 * Providers that do not require an API key (local or free OpenAI-compatible
 * endpoints). The router enables these by default so a first-time user with
 * zero credentials still has at least one working provider.
 */
export const KEYLESS_PROVIDERS: readonly ProviderName[] = [
  'ollama',
  'lmstudio',
  'localai',
  'pollinations',
] as const;
