/**
 * 🐟 AZERCLAW Onboard Command
 * Interactive first-time setup wizard (OpenClaw-style).
 * 
 * Flow:
 *   1. Auto-detect API keys from environment variables
 *   2. If keys found → show what was detected, ask to confirm or configure more
 *   3. If no keys → guide through provider selection + key entry
 *   4. Select default provider + model
 *   5. Configure fallback provider (optional)
 *   6. Agent settings (name, permissions)
 *   7. Project init prompt
 *   8. Channel integrations (optional)
 *   9. Summary + next steps
 */

const chalk = require('chalk');
const gradientString = require('gradient-string');
const Enquirer = require('enquirer');
const { getConfigManager } = require('../../config/manager');
const { resetRouter } = require('../../providers/router');
const { fishSuccess, fishError, fishInfo, fishWarn, fishBox, FishThinkingAnimation } = require('../animations/fish');
const { PROVIDER_MODELS, PROVIDER_LABELS } = require('./settings');

const LUXE = gradientString(['#c084fc', '#818cf8', '#60a5fa', '#34d399']);
const OCEAN = gradientString(['#0ea5e9', '#06b6d4', '#14b8a6']);
const BLOOD = gradientString(['#7f1d1d', '#ef4444', '#dc2626', '#b91c1c']);

const PROVIDERS = [
  { name: 'OpenAI', value: 'openai', hint: 'GPT-4o, GPT-4.1, o3, o4-mini', keyPrefix: 'sk-', envVar: 'OPENAI_API_KEY', local: false },
  { name: 'Anthropic', value: 'anthropic', hint: 'Claude Opus 4, Sonnet 4, Haiku', keyPrefix: 'sk-ant-', envVar: 'ANTHROPIC_API_KEY', local: false },
  { name: 'Google Gemini', value: 'google', hint: 'Gemini 2.5 Pro/Flash', keyPrefix: 'AI', envVar: 'GOOGLE_API_KEY', local: false },
  { name: 'Groq', value: 'groq', hint: 'Llama 3.3, Mixtral (fast inference)', keyPrefix: 'gsk_', envVar: 'GROQ_API_KEY', local: false },
  { name: 'DeepSeek', value: 'deepseek', hint: 'DeepSeek V3, R1', keyPrefix: 'sk-', envVar: '', local: false },
  { name: 'OpenRouter', value: 'openrouter', hint: '100+ models via one key', keyPrefix: 'sk-or-', envVar: 'OPENROUTER_API_KEY', local: false },
  { name: 'Ollama (Local)', value: 'ollama', hint: 'Free, runs on your machine — port 11434', keyPrefix: '', envVar: '', local: true },
  { name: 'LM Studio (Local)', value: 'lmstudio', hint: 'Free, runs on your machine — port 1234', keyPrefix: '', envVar: '', local: true },
  { name: 'LocalAI (Local)', value: 'localai', hint: 'Free, runs on your machine — port 8080', keyPrefix: '', envVar: '', local: true },
  { name: 'Custom (OpenAI-compatible)', value: 'custom', hint: 'Any endpoint', keyPrefix: '', envVar: '', local: false },
];

// ─── Local LLM Server Detection ─────────────────────────────────

const LOCAL_SERVERS = [
  { name: 'Ollama', provider: 'ollama', url: 'http://localhost:11434', testPath: '/api/tags' },
  { name: 'LM Studio', provider: 'lmstudio', url: 'http://localhost:1234', testPath: '/v1/models' },
  { name: 'LocalAI', provider: 'localai', url: 'http://localhost:8080', testPath: '/v1/models' },
];

async function detectLocalServers(): Promise<{ name: string; provider: string; url: string; models?: string[] }[]> {
  const detected: { name: string; provider: string; url: string; models?: string[] }[] = [];
  
  for (const server of LOCAL_SERVERS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${server.url}${server.testPath}`, { signal: controller.signal });
      clearTimeout(timeout);
      
      if (res.ok) {
        const data = await res.json() as any;
        let models: string[] = [];
        
        // Extract model names based on API format
        if (data.models) {
          // Ollama format
          models = data.models.map((m: any) => m.name || m.model || '').filter(Boolean).slice(0, 5);
        } else if (data.data) {
          // OpenAI-compatible format (LM Studio, LocalAI)
          models = data.data.map((m: any) => m.id || '').filter(Boolean).slice(0, 5);
        }
        
        detected.push({ ...server, models });
      }
    } catch { /* server not running, skip */ }
  }
  
  return detected;
}

function maskKey(key: string): string {
  if (!key || key.length < 8) return '****';
  return `${key.slice(0, 4)}${'*'.repeat(Math.min(12, key.length - 8))}${key.slice(-4)}`;
}

export async function runOnboard(): Promise<void> {
  const config = getConfigManager();
  
  console.log('');
  fishBox('🐟 AZERTRON X1.0 Setup', [
    '',
    chalk.hex('#e2e8f0')('  Welcome to AZERCLAW — your AI, your keys, your way.'),
    '',
    chalk.dim('  Your keys are stored locally at ~/.azerclaw/settings.json'),
    chalk.dim('  Nothing is ever sent to our servers. Zero telemetry.'),
    '',
    LUXE('  BYOK — Bring Your Own Key — Zero platform fees'),
    '',
  ]);
  console.log('');

   // ─── Step 1: Auto-detect environment variables ────────────

  const detectedProviders = config.resolveEnvOverrides();

  // ─── Step 1b: Auto-detect local LLM servers ───────────────

  const localThinking = new FishThinkingAnimation('Scanning for local LLM servers');
  localThinking.start();
  const localServers = await detectLocalServers();
  localThinking.stop();

  if (localServers.length > 0) {
    fishBox('🖥️  Local LLM Servers Detected', [
      '',
      ...localServers.map(s => {
        const models = s.models && s.models.length > 0 
          ? chalk.dim(`models: ${s.models.join(', ')}`)
          : chalk.dim('running');
        return `  ${chalk.hex('#34d399')('●')} ${chalk.hex('#e2e8f0')(s.name.padEnd(18))} ${models}`;
      }),
      '',
      chalk.dim('  These are free, local models — no API key needed.'),
      '',
    ]);
    console.log('');

    const useLocal: boolean = await new Enquirer.Confirm({
      name: 'useLocal',
      message: OCEAN('Enable detected local LLM servers?'),
      initial: true,
    }).run().catch(() => true);

    if (useLocal) {
      for (const server of localServers) {
        const baseUrl = server.provider === 'ollama' ? server.url : `${server.url}/v1`;
        config.set(`ai.providers.${server.provider}.baseUrl`, baseUrl);
        config.set(`ai.providers.${server.provider}.enabled`, true);
        
        // Set default model if we detected any
        if (server.models && server.models.length > 0) {
          config.set(`ai.providers.${server.provider}.defaultModel`, server.models[0]);
        }
        
        if (!detectedProviders.includes(server.provider)) {
          detectedProviders.push(server.provider);
        }
        fishSuccess(`${server.name} enabled at ${server.url}`);
      }
    }
  }
  
  if (detectedProviders.length > 0) {
    // Only show API key detection box for non-local providers
    const cloudProviders = detectedProviders.filter((p: string) => !['ollama', 'lmstudio', 'localai'].includes(p));
    if (cloudProviders.length > 0) {
      fishBox('🔍 Auto-Detected API Keys', [
        '',
        ...cloudProviders.map((p: string) => {
          const prov = (config.getAll().ai.providers as any)[p];
          const label = PROVIDER_LABELS[p] || p;
          return `  ${chalk.hex('#34d399')('●')} ${chalk.hex('#e2e8f0')(label.padEnd(18))} ${chalk.dim(maskKey(prov.apiKey))}`;
        }),
        '',
        chalk.dim('  Detected from your environment variables.'),
        '',
      ]);
      console.log('');
    }

    // Ask if they want to use detected keys or configure manually
    const useDetected: boolean = await new Enquirer.Confirm({
      name: 'useDetected',
      message: OCEAN('Use these detected API keys?'),
      initial: true,
    }).run().catch(() => true);

    if (useDetected) {
      // Set the first detected as default
      if (detectedProviders.length > 1) {
        const defaultProvider: string = await new Enquirer.Select({
          name: 'defaultProvider',
          message: OCEAN('Select your primary AI provider:'),
          choices: detectedProviders.map((p: string) => ({
            name: p,
            message: `${PROVIDER_LABELS[p] || p}`,
            hint: chalk.dim((config.getAll().ai.providers as any)[p]?.defaultModel || ''),
          })),
        }).run().catch(() => detectedProviders[0]);

        config.set('ai.defaultProvider', defaultProvider);
      }

      // Ask about fallback
      if (detectedProviders.length > 1) {
        await configureFallback(config, detectedProviders);
      }

      // Ask if they want to add more providers
      const addMore: boolean = await new Enquirer.Confirm({
        name: 'addMore',
        message: chalk.dim('Would you like to configure additional providers?'),
        initial: false,
      }).run().catch(() => false);

      if (addMore) {
        await configureProviders(config, detectedProviders);
      }
    } else {
      await configureProviders(config, []);
    }
  } else {
    // No env keys detected — full manual setup
    fishInfo('No API keys detected in environment. Let\'s set them up.');
    console.log('');
    await configureProviders(config, []);
  }

  // ─── Step 2: Select default model ─────────────────────────

  const defaultProvider = config.getAll().ai.defaultProvider;
  const knownModels = PROVIDER_MODELS[defaultProvider] || [];
  
  if (knownModels.length > 0) {
    console.log('');
    const currentModel = (config.getAll().ai.providers as any)[defaultProvider]?.defaultModel;
    
    const selectedModel: string = await new Enquirer.Select({
      name: 'model',
      message: OCEAN(`Select default model for ${PROVIDER_LABELS[defaultProvider] || defaultProvider}:`),
      choices: [
        ...knownModels.map((m: any) => ({
          name: m.id,
          message: `${m.name.padEnd(25)} ${chalk.dim(m.hint)}`,
          hint: m.id === currentModel ? chalk.hex('#34d399')(' ● current') : '',
        })),
        { name: '__keep__', message: chalk.dim(`Keep current (${currentModel})`), hint: '' },
      ],
    }).run().catch(() => '__keep__');

    if (selectedModel !== '__keep__') {
      config.setProviderModel(selectedModel);
    }
  }

  // ─── Step 3: Agent permissions ─────────────────────────────

  console.log('');
  fishBox('🔒 Permissions', [
    chalk.dim('  Choose which actions require your approval.'),
  ]);

  const permMode: string = await new Enquirer.Select({
    name: 'permMode',
    message: OCEAN('Tool approval mode:'),
    choices: [
      { name: 'safe', message: `${chalk.hex('#34d399')('Safe')}      — Approve shell commands and file writes`, hint: chalk.dim('recommended') },
      { name: 'turbo', message: `${chalk.hex('#fbbf24')('Turbo')}     — Auto-approve everything`, hint: chalk.dim('yolo mode') },
      { name: 'strict', message: `${chalk.hex('#60a5fa')('Strict')}    — Approve all tool calls`, hint: chalk.dim('maximum control') },
    ],
  }).run().catch(() => 'safe');

  switch (permMode) {
    case 'turbo':
      config.set('agent.approvalRequired', false);
      config.set('permissions.autoApprove', ['run_shell', 'write_file', 'read_file', 'list_directory', 'search_files']);
      config.set('permissions.requireApproval', []);
      break;
    case 'strict':
      config.set('agent.approvalRequired', true);
      config.set('permissions.autoApprove', []);
      config.set('permissions.requireApproval', ['run_shell', 'write_file', 'read_file', 'list_directory', 'search_files']);
      break;
    case 'safe':
    default:
      config.set('agent.approvalRequired', true);
      config.set('permissions.autoApprove', ['read_file', 'list_directory', 'search_files']);
      config.set('permissions.requireApproval', ['run_shell', 'write_file']);
      break;
  }

  // ─── Step 4: Project initialization prompt ────────────────

  console.log('');
  if (!config.hasProjectSettings()) {
    const initProject: boolean = await new Enquirer.Confirm({
      name: 'initProject',
      message: OCEAN('Initialize AZERCLAW for this project? (creates AZERCLAW.md + .azerclaw/)'),
      initial: true,
    }).run().catch(() => false);

    if (initProject) {
      config.initProject();
      fishSuccess('Project initialized — edit AZERCLAW.md to add context for the AI agent.');
    }
  } else {
    fishInfo('Project settings already configured (.azerclaw/ found).');
  }

  // ─── Step 5: Optional channel integrations ────────────────

  console.log('');
  const configureChannels: boolean = await new Enquirer.Confirm({
    name: 'configureChannels',
    message: chalk.dim('Configure Discord, Telegram, or Slack integrations? (optional)'),
    initial: false,
  }).run().catch(() => false);

  if (configureChannels) {
    const channels: string[] = await new Enquirer.MultiSelect({
      name: 'channels',
      message: 'Select channels to configure:',
      choices: ['Discord', 'Telegram', 'Slack'],
    }).run().catch(() => []);

    for (const channel of channels) {
      const channelKey = channel.toLowerCase();
      const token: string = await new Enquirer.Password({
        message: `${channel} Bot Token:`,
      }).run().catch(() => '');

      if (token) {
        config.set(`channels.${channelKey}.token`, token);
        config.set(`channels.${channelKey}.enabled`, true);
        fishSuccess(`${channel} configured`);
      }
    }
  }

  // ─── Finalize ─────────────────────────────────────────────

  config.completeFirstRun();
  resetRouter();

  const status = config.getStatus();
  const enabledProviders = config.getEnabledProviders();

  console.log('');
  fishBox('✅ Setup Complete', [
    '',
    `  ${chalk.hex('#818cf8')('Provider:')}  ${chalk.hex('#34d399')(PROVIDER_LABELS[status.provider] || status.provider)}`,
    `  ${chalk.hex('#818cf8')('Model:')}     ${chalk.hex('#34d399')(status.model)}`,
    `  ${chalk.hex('#818cf8')('Fallback:')}  ${chalk.hex('#34d399')(status.fallback || chalk.dim('none'))}`,
    `  ${chalk.hex('#818cf8')('Auth:')}      ${chalk.hex('#34d399')(status.authRoute === 'env_var' ? 'Environment variable' : status.authRoute === 'api_key' ? 'Config file' : 'Not configured')}`,
    '',
    chalk.dim('  Get started:'),
    chalk.hex('#818cf8')('  azerclaw            ') + chalk.dim('— Launch interactive session'),
    chalk.hex('#818cf8')('  azerclaw run "task"  ') + chalk.dim('— Execute a task directly'),
    chalk.hex('#818cf8')('  azerclaw config     ') + chalk.dim('— View/change settings'),
    chalk.hex('#818cf8')('  azerclaw doctor     ') + chalk.dim('— Health check'),
    '',
    chalk.dim('  In-session commands:'),
    chalk.hex('#818cf8')('  /model              ') + chalk.dim('— Switch model'),
    chalk.hex('#818cf8')('  /provider           ') + chalk.dim('— Switch provider'),
    chalk.hex('#818cf8')('  /config             ') + chalk.dim('— Settings menu'),
    chalk.hex('#818cf8')('  /status             ') + chalk.dim('— Current status'),
    chalk.hex('#818cf8')('  /help               ') + chalk.dim('— All commands'),
    '',
  ]);
  console.log('');
}

// ─── Helper: Configure Providers ────────────────────────────────

async function configureProviders(config: any, alreadyConfigured: string[]): Promise<void> {
  const availableProviders = PROVIDERS.filter(p => !alreadyConfigured.includes(p.value));

  const selected: string[] = await new Enquirer.MultiSelect({
    name: 'providers',
    message: OCEAN('Which AI providers would you like to configure?'),
    choices: availableProviders.map((p: any) => ({
      name: p.value,
      message: `${p.name}`,
      hint: chalk.dim(p.hint),
    })),
    result(names: string[]) { return names; },
  }).run().catch(() => []);

  if (!selected || selected.length === 0) {
    if (alreadyConfigured.length === 0) {
      fishWarn('No providers configured. You can add them later with: azerclaw config provider');
    }
    return;
  }

  for (const providerValue of selected) {
    const provider = PROVIDERS.find((p: any) => p.value === providerValue);
    if (!provider) continue;

    console.log('');
    console.log(LUXE(`  ─── ${provider.name} ───`));

    if (provider.value === 'ollama') {
      const baseUrl: string = await new Enquirer.Input({
        name: 'baseUrl',
        message: 'Ollama base URL:',
        initial: 'http://localhost:11434',
      }).run().catch(() => 'http://localhost:11434');

      config.set(`ai.providers.ollama.baseUrl`, baseUrl);
      config.set(`ai.providers.ollama.enabled`, true);
      fishSuccess(`Ollama configured at ${baseUrl}`);
      continue;
    }

    if (provider.value === 'lmstudio') {
      const baseUrl: string = await new Enquirer.Input({
        name: 'baseUrl',
        message: 'LM Studio base URL:',
        initial: 'http://localhost:1234/v1',
      }).run().catch(() => 'http://localhost:1234/v1');

      config.set(`ai.providers.lmstudio.baseUrl`, baseUrl);
      config.set(`ai.providers.lmstudio.enabled`, true);

      const model: string = await new Enquirer.Input({
        message: 'Default model name (or leave blank for auto):',
        initial: '',
      }).run().catch(() => '');
      if (model) config.set(`ai.providers.lmstudio.defaultModel`, model);

      fishSuccess(`LM Studio configured at ${baseUrl}`);
      continue;
    }

    if (provider.value === 'localai') {
      const baseUrl: string = await new Enquirer.Input({
        name: 'baseUrl',
        message: 'LocalAI base URL:',
        initial: 'http://localhost:8080/v1',
      }).run().catch(() => 'http://localhost:8080/v1');

      config.set(`ai.providers.localai.baseUrl`, baseUrl);
      config.set(`ai.providers.localai.enabled`, true);

      const model: string = await new Enquirer.Input({
        message: 'Default model name (or leave blank for auto):',
        initial: '',
      }).run().catch(() => '');
      if (model) config.set(`ai.providers.localai.defaultModel`, model);

      fishSuccess(`LocalAI configured at ${baseUrl}`);
      continue;
    }

    if (provider.value === 'custom') {
      const baseUrl: string = await new Enquirer.Input({
        message: 'API Base URL:',
        initial: 'https://api.example.com/v1',
      }).run().catch(() => '');
      
      const apiKey: string = await new Enquirer.Password({
        message: 'API Key:',
      }).run().catch(() => '');

      const model: string = await new Enquirer.Input({
        message: 'Default model name:',
      }).run().catch(() => '');

      if (baseUrl && apiKey) {
        config.set('ai.providers.custom.baseUrl', baseUrl);
        config.set('ai.providers.custom.apiKey', apiKey);
        config.set('ai.providers.custom.defaultModel', model);
        config.set('ai.providers.custom.enabled', true);
        fishSuccess('Custom provider configured');
      }
      continue;
    }

    // Standard API key providers
    const apiKey: string = await new Enquirer.Password({
      name: 'apiKey',
      message: `${provider.name} API Key:`,
      hint: provider.keyPrefix ? chalk.dim(`starts with ${provider.keyPrefix}...`) : undefined,
    }).run().catch(() => '');

    if (apiKey) {
      config.setProviderKey(provider.value as any, apiKey);
      fishSuccess(`${provider.name} configured`);
    } else {
      fishError(`${provider.name} skipped`);
    }
  }

  // Select default provider if multiple are now enabled
  const allEnabled = config.getEnabledProviders();
  if (allEnabled.length > 1) {
    console.log('');
    const defaultProvider: string = await new Enquirer.Select({
      name: 'defaultProvider',
      message: OCEAN('Select your primary AI provider:'),
      choices: allEnabled.map((p: any) => ({
        name: p.name,
        message: PROVIDER_LABELS[p.name] || p.name,
      })),
    }).run().catch(() => allEnabled[0].name);

    config.set('ai.defaultProvider', defaultProvider);

    // Configure fallback
    await configureFallback(config, allEnabled.map((p: any) => p.name));
  }
}

// ─── Helper: Configure Fallback ─────────────────────────────────

async function configureFallback(config: any, enabledProviders: string[]): Promise<void> {
  const defaultProvider = config.getAll().ai.defaultProvider;
  const fallbackCandidates = enabledProviders.filter((p: string) => p !== defaultProvider);

  if (fallbackCandidates.length === 0) return;

  console.log('');
  const configureFb: boolean = await new Enquirer.Confirm({
    name: 'configureFallback',
    message: OCEAN('Configure a fallback provider? (used when primary fails)'),
    initial: true,
  }).run().catch(() => false);

  if (!configureFb) return;

  const fallbackProvider: string = await new Enquirer.Select({
    name: 'fallback',
    message: OCEAN('Select fallback provider:'),
    choices: fallbackCandidates.map((p: string) => ({
      name: p,
      message: `${PROVIDER_LABELS[p] || p}`,
      hint: chalk.dim((config.getAll().ai.providers as any)[p]?.defaultModel || ''),
    })),
  }).run().catch(() => fallbackCandidates[0]);

  // Put fallback provider right after the default in the chain
  const chain = [defaultProvider, fallbackProvider, ...enabledProviders.filter(
    (p: string) => p !== defaultProvider && p !== fallbackProvider
  )];
  config.setFallbackChain(chain);
  fishSuccess(`Fallback: ${PROVIDER_LABELS[fallbackProvider] || fallbackProvider}`);
}

module.exports = { runOnboard };
