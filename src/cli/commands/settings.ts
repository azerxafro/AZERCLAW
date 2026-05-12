/**
 * 🐟 AZERCLAW Interactive Settings
 * Mid-session provider, model, API key, and config switching.
 * 
 * Provides all in-session slash commands:
 *   /config    — Tabbed interactive settings menu
 *   /model     — Switch model (with model picker)
 *   /provider  — Switch provider
 *   /apikey    — Change an API key
 *   /status    — Show current status
 *   /init      — Initialize project settings
 *   /compact   — Compact conversation context
 *   /fallback  — Configure fallback provider
 * 
 * Also provides CLI helpers for non-interactive usage:
 *   azerclaw config provider [name]
 *   azerclaw config model [id]
 *   azerclaw config apikey [provider] [key]
 */

import chalk from 'chalk';
import gradientString from 'gradient-string';
import Enquirer from 'enquirer';
import { getConfigManager } from '../../config/manager';
import { resetRouter } from '../../providers/router';
import { KEYLESS_PROVIDERS } from '../../config/schema';
import type { AIConfig, ProviderConfig, ProviderName } from '../../config/schema';
import { fishSuccess, fishError, fishInfo, fishBox, fishWarn } from '../animations/fish';

/** Typed accessor for a provider entry inside `ai.providers`. */
function getProviderConfig(aiConfig: AIConfig, name: string): ProviderConfig | undefined {
  return (aiConfig.providers as Record<string, ProviderConfig | undefined>)[name];
}

/** Providers that do not require an API key (ollama, lmstudio, localai, pollinations). */
const KEYLESS_PROVIDER_SET = new Set<string>(KEYLESS_PROVIDERS);

const LUXE = gradientString(['#c084fc', '#818cf8', '#60a5fa', '#34d399']);
const OCEAN = gradientString(['#0ea5e9', '#06b6d4', '#14b8a6']);
const BLOOD = gradientString(['#7f1d1d', '#ef4444', '#dc2626', '#b91c1c']);

// ─── Known Models Per Provider ──────────────────────────────────

export const PROVIDER_MODELS: Record<string, { name: string; id: string; hint: string }[]> = {
  openai: [
    { name: 'GPT-4o', id: 'gpt-4o', hint: 'Best all-around' },
    { name: 'GPT-4o Mini', id: 'gpt-4o-mini', hint: 'Fast & cheap' },
    { name: 'GPT-4.1', id: 'gpt-4.1', hint: 'Latest flagship' },
    { name: 'GPT-4.1 Mini', id: 'gpt-4.1-mini', hint: 'Balanced' },
    { name: 'GPT-4.1 Nano', id: 'gpt-4.1-nano', hint: 'Ultra-fast' },
    { name: 'o3', id: 'o3', hint: 'Reasoning' },
    { name: 'o4-mini', id: 'o4-mini', hint: 'Fast reasoning' },
  ],
  anthropic: [
    { name: 'Claude Opus 4', id: 'claude-opus-4-20250514', hint: 'Most capable' },
    { name: 'Claude Sonnet 4', id: 'claude-sonnet-4-20250514', hint: 'Best balance' },
    { name: 'Claude Haiku 3.5', id: 'claude-3-5-haiku-20241022', hint: 'Fast & cheap' },
  ],
  google: [
    { name: 'Gemini 2.5 Pro', id: 'gemini-2.5-pro', hint: 'Most capable' },
    { name: 'Gemini 2.5 Flash', id: 'gemini-2.5-flash', hint: 'Fast & smart' },
    { name: 'Gemini 2.0 Flash', id: 'gemini-2.0-flash', hint: 'Affordable' },
  ],
  groq: [
    { name: 'Llama 3.3 70B', id: 'llama-3.3-70b-versatile', hint: 'Versatile' },
    { name: 'Llama 3.1 8B', id: 'llama-3.1-8b-instant', hint: 'Blazing fast' },
    { name: 'Mixtral 8x7B', id: 'mixtral-8x7b-32768', hint: 'Large context' },
  ],
  deepseek: [
    { name: 'DeepSeek Chat', id: 'deepseek-chat', hint: 'General' },
    { name: 'DeepSeek Reasoner', id: 'deepseek-reasoner', hint: 'Reasoning' },
  ],
  openrouter: [
    { name: 'Claude Sonnet 4', id: 'anthropic/claude-sonnet-4', hint: 'Via OpenRouter' },
    { name: 'GPT-4o', id: 'openai/gpt-4o', hint: 'Via OpenRouter' },
    { name: 'Gemini 2.5 Pro', id: 'google/gemini-2.5-pro', hint: 'Via OpenRouter' },
    { name: 'Llama 3.3 70B (Free)', id: 'meta-llama/llama-3.3-70b-instruct:free', hint: 'Free via OpenRouter' },
  ],
  pollinations: [
    { name: 'OpenAI (default)', id: 'openai', hint: 'Free, no key required' },
    { name: 'OpenAI Large', id: 'openai-large', hint: 'Free, larger context' },
    { name: 'Mistral', id: 'mistral', hint: 'Free' },
    { name: 'Llama', id: 'llama', hint: 'Free' },
  ],
  ollama: [
    { name: 'Llama 3.1', id: 'llama3.1', hint: 'General purpose' },
    { name: 'Llama 3.2', id: 'llama3.2', hint: 'Latest' },
    { name: 'Codellama', id: 'codellama', hint: 'Code generation' },
    { name: 'Mistral', id: 'mistral', hint: 'Fast & capable' },
    { name: 'Deepseek Coder V2', id: 'deepseek-coder-v2', hint: 'Coding' },
    { name: 'Qwen 2.5', id: 'qwen2.5', hint: 'Multilingual' },
    { name: 'Phi-3', id: 'phi3', hint: 'Microsoft, small & fast' },
  ],
  lmstudio: [
    { name: 'Use loaded model', id: 'local-model', hint: 'Whatever is loaded in LM Studio' },
  ],
  localai: [
    { name: 'Use loaded model', id: 'local-model', hint: 'Whatever is loaded in LocalAI' },
  ],
  custom: [],
};

export const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google Gemini',
  groq: 'Groq',
  deepseek: 'DeepSeek',
  openrouter: 'OpenRouter',
  pollinations: 'Pollinations (Free)',
  ollama: 'Ollama (Local)',
  lmstudio: 'LM Studio (Local)',
  localai: 'LocalAI (Local)',
  custom: 'Custom',
};

// ─── /status — Show Current Status ──────────────────────────────

export function showStatus(): void {
  const config = getConfigManager();
  const status = config.getStatus();

  const authLabel = status.authRoute === 'env_var' ? 'Environment Variable'
    : status.authRoute === 'api_key' ? 'Config File'
    : chalk.hex('#f87171')('Not Configured');

  fishBox('🐟 AZERCLAW Status', [
    '',
    `  ${chalk.hex('#818cf8')('Version:')}     ${chalk.hex('#e2e8f0')(`v${status.version}`)}`,
    `  ${chalk.hex('#818cf8')('Provider:')}    ${chalk.hex('#34d399')(PROVIDER_LABELS[status.provider] || status.provider)}`,
    `  ${chalk.hex('#818cf8')('Model:')}       ${chalk.hex('#34d399')(status.model)}`,
    `  ${chalk.hex('#818cf8')('Fallback:')}    ${chalk.hex('#34d399')(status.fallback || chalk.dim('none — use /fallback to set'))}`,
    `  ${chalk.hex('#818cf8')('Auth Route:')}  ${chalk.hex('#34d399')(authLabel)}`,
    `  ${chalk.hex('#818cf8')('Providers:')}   ${chalk.hex('#e2e8f0')(status.enabledProviders.map((p: string) => PROVIDER_LABELS[p] || p).join(', ') || chalk.dim('none'))}`,
    `  ${chalk.hex('#818cf8')('Project:')}     ${status.projectConfigured ? chalk.hex('#34d399')('Configured') : chalk.dim('Not initialized — use /init')}`,
    `  ${chalk.hex('#818cf8')('Config:')}      ${chalk.dim(status.configFile)}`,
    '',
  ]);
}

// ─── /config — Tabbed Settings Menu ─────────────────────────────

export async function interactiveSettingsMenu(): Promise<void> {
  const config = getConfigManager();
  const aiConfig = config.getAll().ai;
  const currentProvider = aiConfig.defaultProvider;
  const currentModel = getProviderConfig(aiConfig, currentProvider)?.defaultModel || 'default';
  const fallback = config.getFallbackProvider();

  fishBox('⚙️  Configuration', [
    '',
    `  ${chalk.hex('#818cf8')('Provider:')}   ${chalk.hex('#34d399')(PROVIDER_LABELS[currentProvider] || currentProvider)}`,
    `  ${chalk.hex('#818cf8')('Model:')}      ${chalk.hex('#34d399')(currentModel)}`,
    `  ${chalk.hex('#818cf8')('Fallback:')}   ${chalk.hex('#34d399')(fallback ? `${PROVIDER_LABELS[fallback.name] || fallback.name} (${fallback.config.defaultModel})` : chalk.dim('none'))}`,
    '',
  ]);

  const actions = [
    { name: 'provider', message: `${chalk.hex('#60a5fa')('🔄')} Switch Provider`, hint: chalk.dim('Change primary AI backend') },
    { name: 'model', message: `${chalk.hex('#a855f7')('🧠')} Change Model`, hint: chalk.dim('Switch model for current provider') },
    { name: 'apikey', message: `${chalk.hex('#fbbf24')('🔑')} Update API Key`, hint: chalk.dim('Change or set an API key') },
    { name: 'fallback', message: `${chalk.hex('#06b6d4')('🛡️')} Configure Fallback`, hint: chalk.dim('Set backup provider') },
    { name: 'permissions', message: `${chalk.hex('#34d399')('🔒')} Permissions`, hint: chalk.dim('Tool approval rules') },
    { name: 'advanced', message: `${chalk.hex('#818cf8')('⚡')} Advanced Settings`, hint: chalk.dim('Temperature, tokens, etc.') },
    { name: 'back', message: `${chalk.hex('#6b7280')('←')}  Back`, hint: '' },
  ];

  try {
    const action: string = await new Enquirer.Select({
      name: 'action',
      message: OCEAN('What would you like to configure?'),
      choices: actions,
    }).run();

    switch (action) {
      case 'provider': await interactiveProviderSwitch(); break;
      case 'model': await interactiveModelSwitch(); break;
      case 'apikey': await interactiveApiKeyChange(); break;
      case 'fallback': await interactiveFallbackConfig(); break;
      case 'permissions': await interactivePermissions(); break;
      case 'advanced': await interactiveAdvanced(); break;
      case 'back': break;
    }
  } catch { /* user cancelled */ }
}

// ─── /provider — Interactive Provider Switch ────────────────────

export async function interactiveProviderSwitch(): Promise<boolean> {
  const config = getConfigManager();
  const aiConfig = config.getAll().ai;
  const allProviders = Object.keys(aiConfig.providers);

  const choices = allProviders.map((p: string) => {
    const prov = getProviderConfig(aiConfig, p);
    const isActive = p === aiConfig.defaultProvider;
    const isEnabled = prov?.enabled;
    const status = isActive
      ? chalk.hex('#34d399')('● ACTIVE')
      : isEnabled
        ? chalk.hex('#60a5fa')('○ Ready')
        : chalk.hex('#6b7280')('○ Not configured');

    return {
      name: p,
      message: `${(PROVIDER_LABELS[p] || p).padEnd(22)} ${status}`,
      hint: prov?.defaultModel ? chalk.dim(`model: ${prov.defaultModel}`) : '',
    };
  });

  try {
    const selected: string = await new Enquirer.Select({
      name: 'provider',
      message: OCEAN('Switch to which provider?'),
      choices,
    }).run();

    const provConfig = getProviderConfig(aiConfig, selected);

    if (!KEYLESS_PROVIDER_SET.has(selected) && (!provConfig?.apiKey || provConfig.apiKey === '')) {
      fishWarn(`${PROVIDER_LABELS[selected] || selected} has no API key configured.`);
      const setKey: boolean = await new Enquirer.Confirm({
        name: 'setKey',
        message: 'Would you like to set an API key now?',
        initial: true,
      }).run();

      if (setKey) {
        const apiKey: string = await new Enquirer.Password({
          name: 'apiKey',
          message: `${PROVIDER_LABELS[selected] || selected} API Key:`,
        }).run();

        if (apiKey) {
          config.updateProviderKey(selected as ProviderName, apiKey);
          fishSuccess(`API key set for ${PROVIDER_LABELS[selected] || selected}`);
        } else {
          fishError('No key provided. Provider switch aborted.');
          return false;
        }
      } else {
        fishError('Provider switch aborted — no API key.');
        return false;
      }
    }

    config.switchProvider(selected as ProviderName);
    resetRouter();

    const newModel = getProviderConfig(config.getAll().ai, selected)?.defaultModel || 'default';
    fishSuccess(`Switched to ${PROVIDER_LABELS[selected] || selected} (model: ${newModel})`);
    return true;
  } catch { return false; }
}

// ─── /model — Interactive Model Switch ──────────────────────────

export async function interactiveModelSwitch(): Promise<boolean> {
  const config = getConfigManager();
  const aiConfig = config.getAll().ai;
  const currentProvider = aiConfig.defaultProvider;
  const currentModel = getProviderConfig(aiConfig, currentProvider)?.defaultModel || 'default';

  fishInfo(`Current: ${PROVIDER_LABELS[currentProvider] || currentProvider} → ${currentModel}`);

  const knownModels = PROVIDER_MODELS[currentProvider] || [];
  const choices = [
    ...knownModels.map((m) => ({
      name: m.id,
      message: `${m.name.padEnd(25)} ${chalk.dim(m.hint)}`,
      hint: m.id === currentModel ? chalk.hex('#34d399')(' ● current') : '',
    })),
    {
      name: '__custom__',
      message: chalk.hex('#fbbf24')('✏  Enter a custom model ID'),
      hint: '',
    },
  ];

  try {
    const selected: string = await new Enquirer.Select({
      name: 'model',
      message: OCEAN(`Select model for ${PROVIDER_LABELS[currentProvider] || currentProvider}:`),
      choices,
    }).run();

    let modelId = selected;
    if (selected === '__custom__') {
      modelId = await new Enquirer.Input({
        name: 'customModel',
        message: 'Enter model ID:',
        initial: currentModel,
      }).run();

      if (!modelId || !modelId.trim()) {
        fishError('No model ID entered.');
        return false;
      }
      modelId = modelId.trim();
    }

    config.setProviderModel(modelId);
    resetRouter();
    fishSuccess(`Model switched to ${modelId}`);
    return true;
  } catch { return false; }
}

// ─── /apikey — Interactive API Key Change ───────────────────────

export async function interactiveApiKeyChange(): Promise<boolean> {
  const config = getConfigManager();
  const aiConfig = config.getAll().ai;
  const allProviders = Object.keys(aiConfig.providers).filter((p) => !KEYLESS_PROVIDER_SET.has(p));

  const choices = allProviders.map((p: string) => {
    const prov = getProviderConfig(aiConfig, p);
    const hasKey = !!prov?.apiKey && prov.apiKey.length > 0;
    const status = hasKey
      ? chalk.hex('#34d399')(`● ${maskKey(prov.apiKey)}`)
      : chalk.hex('#6b7280')('○ no key');

    return {
      name: p,
      message: `${(PROVIDER_LABELS[p] || p).padEnd(22)} ${status}`,
    };
  });

  try {
    const selected: string = await new Enquirer.Select({
      name: 'provider',
      message: OCEAN('Change API key for which provider?'),
      choices,
    }).run();

    const apiKey: string = await new Enquirer.Password({
      name: 'apiKey',
      message: `New API key for ${PROVIDER_LABELS[selected] || selected}:`,
    }).run();

    if (!apiKey) {
      fishError('No key entered. Aborted.');
      return false;
    }

    config.updateProviderKey(selected as ProviderName, apiKey);
    resetRouter();
    fishSuccess(`API key updated for ${PROVIDER_LABELS[selected] || selected}: ${maskKey(apiKey)}`);
    return true;
  } catch { return false; }
}

// ─── /fallback — Configure Fallback Provider ────────────────────

export async function interactiveFallbackConfig(): Promise<boolean> {
  const config = getConfigManager();
  const aiConfig = config.getAll().ai;
  const activeProvider = aiConfig.defaultProvider;
  const enabledProviders = config.getEnabledProviders();
  const currentFallback = config.getFallbackProvider();

  if (enabledProviders.length < 2) {
    fishWarn('You need at least 2 enabled providers to configure a fallback.');
    fishInfo('Use /provider or /apikey to set up another provider first.');
    return false;
  }

  fishInfo(`Primary: ${PROVIDER_LABELS[activeProvider] || activeProvider}`);
  if (currentFallback) {
    fishInfo(`Current fallback: ${PROVIDER_LABELS[currentFallback.name] || currentFallback.name} (${currentFallback.config.defaultModel})`);
  }

  const candidates = enabledProviders.filter((p) => p.name !== activeProvider);
  const choices = [
    ...candidates.map((p) => ({
      name: p.name,
      message: `${(PROVIDER_LABELS[p.name] || p.name).padEnd(22)} ${chalk.dim(`model: ${p.config.defaultModel || 'default'}`)}`,
      hint: currentFallback?.name === p.name ? chalk.hex('#34d399')(' ● current fallback') : '',
    })),
    { name: '__none__', message: chalk.hex('#6b7280')('✗  Disable fallback'), hint: '' },
  ];

  try {
    const selected: string = await new Enquirer.Select({
      name: 'fallback',
      message: OCEAN('Select fallback provider:'),
      choices,
    }).run();

    if (selected === '__none__') {
      config.setFallbackChain([activeProvider]);
      fishSuccess('Fallback disabled.');
      return true;
    }

    const chain = [activeProvider, selected, ...enabledProviders
      .map((p) => p.name)
      .filter((n: string) => n !== activeProvider && n !== selected)
    ];
    config.setFallbackChain(chain);
    resetRouter();

    fishSuccess(`Fallback set to ${PROVIDER_LABELS[selected] || selected}`);
    return true;
  } catch { return false; }
}

// ─── /permissions — Interactive Permissions ─────────────────────

async function interactivePermissions(): Promise<void> {
  const config = getConfigManager();
  const all = config.getAll();

  fishBox('🔒 Current Permissions', [
    `  Approval Required: ${all.agent.approvalRequired ? chalk.hex('#34d399')('Yes') : chalk.hex('#fbbf24')('No')}`,
    `  Auto-Approve:      ${chalk.dim((all.permissions?.autoApprove || []).join(', ') || 'none')}`,
    `  Require Approval:  ${chalk.dim((all.permissions?.requireApproval || []).join(', ') || 'none')}`,
  ]);

  const mode: string = await new Enquirer.Select({
    name: 'mode',
    message: OCEAN('Permission mode:'),
    choices: [
      { name: 'safe', message: `${chalk.hex('#34d399')('Safe')}     — Approve shell & file writes`, hint: chalk.dim('recommended') },
      { name: 'turbo', message: `${chalk.hex('#fbbf24')('Turbo')}    — Auto-approve everything`, hint: chalk.dim('yolo') },
      { name: 'strict', message: `${chalk.hex('#60a5fa')('Strict')}   — Approve all tool calls`, hint: chalk.dim('max control') },
      { name: 'keep', message: chalk.dim('Keep current'), hint: '' },
    ],
  }).run().catch(() => 'keep');

  switch (mode) {
    case 'turbo':
      config.set('agent.approvalRequired', false);
      config.set('permissions.autoApprove', ['run_shell', 'write_file', 'read_file', 'list_directory', 'search_files']);
      config.set('permissions.requireApproval', []);
      fishSuccess('Turbo mode enabled — all tools auto-approved');
      break;
    case 'strict':
      config.set('agent.approvalRequired', true);
      config.set('permissions.autoApprove', []);
      config.set('permissions.requireApproval', ['run_shell', 'write_file', 'read_file', 'list_directory', 'search_files']);
      fishSuccess('Strict mode — all tools require approval');
      break;
    case 'safe':
      config.set('agent.approvalRequired', true);
      config.set('permissions.autoApprove', ['read_file', 'list_directory', 'search_files']);
      config.set('permissions.requireApproval', ['run_shell', 'write_file']);
      fishSuccess('Safe mode — shell & writes require approval');
      break;
  }
}

// ─── Advanced Settings ──────────────────────────────────────────

async function interactiveAdvanced(): Promise<void> {
  const config = getConfigManager();
  const all = config.getAll();

  fishBox('⚡ Advanced Settings', [
    `  Temperature:     ${chalk.hex('#34d399')(String(all.ai.temperature))}`,
    `  Max Tokens:      ${chalk.hex('#34d399')(String(all.ai.maxTokens))}`,
    `  Max Iterations:  ${chalk.hex('#34d399')(String(all.agent.maxIterations))}`,
    `  Theme:           ${chalk.hex('#34d399')(all.ui.theme)}`,
  ]);

  const setting: string = await new Enquirer.Select({
    name: 'setting',
    message: OCEAN('Which setting to change?'),
    choices: [
      { name: 'temperature', message: 'Temperature', hint: chalk.dim(`current: ${all.ai.temperature}`) },
      { name: 'maxTokens', message: 'Max Tokens', hint: chalk.dim(`current: ${all.ai.maxTokens}`) },
      { name: 'maxIterations', message: 'Max Iterations', hint: chalk.dim(`current: ${all.agent.maxIterations}`) },
      { name: 'theme', message: 'Theme', hint: chalk.dim(`current: ${all.ui.theme}`) },
      { name: 'back', message: chalk.dim('Back'), hint: '' },
    ],
  }).run().catch(() => 'back');

  switch (setting) {
    case 'temperature': {
      const val: string = await new Enquirer.Input({
        message: 'Temperature (0.0 - 2.0):',
        initial: String(all.ai.temperature),
      }).run().catch(() => '');
      if (val) { config.set('ai.temperature', parseFloat(val)); fishSuccess(`Temperature set to ${val}`); }
      break;
    }
    case 'maxTokens': {
      const val: string = await new Enquirer.Input({
        message: 'Max Tokens:',
        initial: String(all.ai.maxTokens),
      }).run().catch(() => '');
      if (val) { config.set('ai.maxTokens', parseInt(val, 10)); fishSuccess(`Max tokens set to ${val}`); }
      break;
    }
    case 'maxIterations': {
      const val: string = await new Enquirer.Input({
        message: 'Max agent iterations per task:',
        initial: String(all.agent.maxIterations),
      }).run().catch(() => '');
      if (val) { config.set('agent.maxIterations', parseInt(val, 10)); fishSuccess(`Max iterations set to ${val}`); }
      break;
    }
    case 'theme': {
      const theme: string = await new Enquirer.Select({
        name: 'theme',
        message: 'Select theme:',
        choices: ['dark', 'light', 'ocean', 'neon'],
      }).run().catch(() => '');
      if (theme) { config.set('ui.theme', theme); fishSuccess(`Theme set to ${theme}`); }
      break;
    }
  }
}

// ─── /init — Project Initialization ─────────────────────────────

export function initProject(): void {
  const config = getConfigManager();
  
  if (config.hasProjectSettings()) {
    fishInfo('Project already initialized.');
    fishInfo(`  AZERCLAW.md: ${config.paths.projectInstructions}`);
    fishInfo(`  Settings:    ${config.paths.projectSettings}`);
    return;
  }

  config.initProject();
  fishSuccess('Project initialized!');
  fishInfo(`  Created: AZERCLAW.md — Add project context for the AI agent`);
  fishInfo(`  Created: .azerclaw/settings.json — Project-level settings`);
  fishInfo(`  Created: .azerclaw/.gitignore — Protects local settings`);
}

// ─── Non-Interactive CLI Helpers ────────────────────────────────

export function cliSwitchProvider(providerName: string): void {
  const config = getConfigManager();
  try {
    config.switchProvider(providerName as ProviderName);
    resetRouter();
    const model = getProviderConfig(config.getAll().ai, providerName)?.defaultModel || 'default';
    fishSuccess(`Switched to ${PROVIDER_LABELS[providerName] || providerName} (model: ${model})`);
  } catch (e: unknown) {
    fishError(e instanceof Error ? e.message : String(e));
  }
}

export function cliSwitchModel(modelId: string, providerName?: string): void {
  const config = getConfigManager();
  const provider = providerName || config.getAll().ai.defaultProvider;
  config.setProviderModel(modelId, provider as ProviderName);
  resetRouter();
  fishSuccess(`Model set to ${modelId} on ${PROVIDER_LABELS[provider] || provider}`);
}

export function cliSetApiKey(providerName: string, apiKey: string): void {
  const config = getConfigManager();
  config.updateProviderKey(providerName as ProviderName, apiKey);
  resetRouter();
  fishSuccess(`API key updated for ${PROVIDER_LABELS[providerName] || providerName}: ${maskKey(apiKey)}`);
}

export function cliSetFallback(providerName: string): void {
  const config = getConfigManager();
  const activeProvider = config.getAll().ai.defaultProvider;
  
  if (providerName === 'none') {
    config.setFallbackChain([activeProvider]);
    fishSuccess('Fallback disabled.');
    return;
  }

  const chain = [activeProvider, providerName, ...config.getEnabledProviders()
    .map((p: any) => p.name)
    .filter((n: string) => n !== activeProvider && n !== providerName)
  ];
  config.setFallbackChain(chain);
  resetRouter();
  fishSuccess(`Fallback set to ${PROVIDER_LABELS[providerName] || providerName}`);
}

// ─── Helpers ────────────────────────────────────────────────────

function maskKey(key: string): string {
  if (!key || key.length < 8) return '****';
  return `${key.slice(0, 4)}${'*'.repeat(Math.min(16, key.length - 8))}${key.slice(-4)}`;
}

