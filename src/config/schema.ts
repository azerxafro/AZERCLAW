import { z } from 'zod';
import * as process from 'process';

// ─── Provider Schemas ───────────────────────────────────────────

const OpencodeProviderSchema = z.object({
  apiKey: z.string().default(''),
  baseUrl: z.string().default('https://opencode.ai/zen/v1'),
  defaultModel: z.string().default('minimax-m2.5-free'),
  enabled: z.boolean().default(true),
});

const CloudflareProviderSchema = z.object({
  apiKey: z.string().default(''),
  accountId: z.string().default(''),
  defaultModel: z.string().default('@cf/meta/llama-3.1-8b-instruct'),
  enabled: z.boolean().default(false),
});

// ─── Security Schemas ───────────────────────────────────────────

const ChannelSecuritySchema = z.object({
  dmPolicy: z.enum(['pairing', 'open', 'closed']).default('pairing'),
  allowFrom: z.array(z.string()).default([]),
});

// ─── AI Config ──────────────────────────────────────────────────

const ProvidersSchema = z.object({
  opencode: OpencodeProviderSchema,
  cloudflare: CloudflareProviderSchema,
}).default({
  opencode: { 
    apiKey: process.env.AZERTRON_OPENCODE_KEY || '', 
    baseUrl: 'https://opencode.ai/zen/v1', 
    defaultModel: 'minimax-m2.5-free', 
    enabled: true 
  },
  cloudflare: {
    apiKey: process.env.CLOUDFLARE_API_TOKEN || 'cfat_6VEB78twxPiNpGWsqLK9AvDpMlWCBQqMMb3Pasev80dfce17',
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || 'a4233742074c3c8834adcb684068116b',
    defaultModel: '@cf/meta/llama-3.1-8b-instruct',
    enabled: true
  },
});

const AIConfigSchema = z.object({
  defaultProvider: z.string().default('cloudflare'),
  fallbackChain: z.array(z.string()).default(['cloudflare', 'opencode']),
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
  ai: AIConfigSchema.default({
    defaultProvider: 'opencode',
    fallbackChain: [],
    modelFallbackChain: ['opencode/ring-2.6-1t:free', 'minimax-m2.5-free'],
    maxTokens: 4096,
    temperature: 0.7,
    providers: {
      opencode: { 
        apiKey: process.env.AZERTRON_OPENCODE_KEY || '', 
        baseUrl: 'https://opencode.ai/zen/v1', 
        defaultModel: 'opencode/nemotron-3-super-120b-a12b:free', 
        enabled: true 
      },
    },
  }),
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
  version: z.string().default('2.1.2'),
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

export type ProviderName = 'opencode' | 'cloudflare';
