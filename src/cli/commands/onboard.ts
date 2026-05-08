/**
 * 🐟 AZERCLAW Onboard Command
 * Interactive first-time setup wizard with premium UI.
 */

const chalk = require('chalk');
const gradientString = require('gradient-string');
const Enquirer = require('enquirer');
const { getConfigManager } = require('../../config/manager');
const { fishSuccess, fishError, fishInfo, fishBox, FishThinkingAnimation } = require('../animations/fish');

const LUXE = gradientString(['#c084fc', '#818cf8', '#60a5fa', '#34d399']);
const OCEAN = gradientString(['#0ea5e9', '#06b6d4', '#14b8a6']);

const PROVIDERS = [
  { name: 'OpenAI', value: 'openai', hint: 'GPT-4o, GPT-4.1, o3, o4-mini', keyPrefix: 'sk-' },
  { name: 'Anthropic', value: 'anthropic', hint: 'Claude Opus 4, Sonnet 4, Haiku', keyPrefix: 'sk-ant-' },
  { name: 'Google Gemini', value: 'google', hint: 'Gemini 2.5 Pro/Flash', keyPrefix: 'AI' },
  { name: 'Groq', value: 'groq', hint: 'Llama 3.3, Mixtral (fast inference)', keyPrefix: 'gsk_' },
  { name: 'DeepSeek', value: 'deepseek', hint: 'DeepSeek V3, R1', keyPrefix: 'sk-' },
  { name: 'OpenRouter', value: 'openrouter', hint: '100+ models via one key', keyPrefix: 'sk-or-' },
  { name: 'Ollama (Local)', value: 'ollama', hint: 'Free, runs on your machine', keyPrefix: '' },
  { name: 'Custom (OpenAI-compatible)', value: 'custom', hint: 'Any endpoint', keyPrefix: '' },
];

export async function runOnboard(): Promise<void> {
  const config = getConfigManager();
  
  console.log('');
  fishBox('🐟 AZERCLAW Setup Wizard', [
    chalk.dim('Welcome! Let\'s configure your AI providers.'),
    chalk.dim('Your keys are stored locally at ~/.azerclaw/config.json'),
    chalk.dim('You can change these anytime with: azerclaw config'),
    '',
    LUXE('BYOK — Bring Your Own Key — Zero platform fees'),
  ]);
  console.log('');

  // Provider selection
  const { providers } = await new Enquirer.MultiSelect({
    name: 'providers',
    message: OCEAN('Which AI providers would you like to configure?'),
    choices: PROVIDERS.map(p => ({
      name: p.value,
      message: `${p.name}`,
      hint: chalk.dim(p.hint),
    })),
    result(names: string[]) { return names; },
  }).run().catch(() => ({ providers: [] }));

  if (!providers || providers.length === 0) {
    fishWarnMsg('No providers selected. You can configure later with: azerclaw config set ai.providers.<name>.apiKey <key>');
    return;
  }

  // Configure each provider
  for (const providerValue of providers) {
    const provider = PROVIDERS.find(p => p.value === providerValue);
    if (!provider) continue;

    console.log('');
    console.log(LUXE(`  ─── ${provider.name} ───`));

    if (provider.value === 'ollama') {
      const { baseUrl } = await new Enquirer.Input({
        name: 'baseUrl',
        message: 'Ollama base URL:',
        initial: 'http://localhost:11434',
      }).run().then((val: string) => ({ baseUrl: val })).catch(() => ({ baseUrl: 'http://localhost:11434' }));

      config.set(`ai.providers.ollama.baseUrl`, baseUrl);
      config.set(`ai.providers.ollama.enabled`, true);
      fishSuccess(`Ollama configured at ${baseUrl}`);
      continue;
    }

    if (provider.value === 'custom') {
      const baseUrl = await new Enquirer.Input({
        message: 'API Base URL:',
        initial: 'https://api.example.com/v1',
      }).run().catch(() => '');
      
      const apiKey = await new Enquirer.Password({
        message: 'API Key:',
      }).run().catch(() => '');

      const model = await new Enquirer.Input({
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
    const apiKey = await new Enquirer.Password({
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

  // Select default provider
  const enabledProviders = config.getEnabledProviders();
  if (enabledProviders.length > 1) {
    console.log('');
    const { defaultProvider } = await new Enquirer.Select({
      name: 'defaultProvider',
      message: OCEAN('Select your default AI provider:'),
      choices: enabledProviders.map((p: { name: string }) => ({
        name: p.name,
        message: PROVIDERS.find(pr => pr.value === p.name)?.name || p.name,
      })),
    }).run().then((val: string) => ({ defaultProvider: val })).catch(() => ({ defaultProvider: enabledProviders[0].name }));

    config.set('ai.defaultProvider', defaultProvider);
  }

  // Agent settings
  console.log('');
  fishBox('⚙️ Agent Settings', [
    chalk.dim('Configure how your AI agent behaves'),
  ]);

  const { agentName } = await new Enquirer.Input({
    name: 'agentName',
    message: 'Agent name:',
    initial: 'Azerclaw',
  }).run().then((val: string) => ({ agentName: val })).catch(() => ({ agentName: 'Azerclaw' }));

  config.set('agent.name', agentName);
  config.completeFirstRun();

  // Final summary
  console.log('');
  fishBox('✅ Setup Complete', [
    LUXE(`Agent: ${agentName}`),
    chalk.hex('#60a5fa')(`Providers: ${enabledProviders.map((p: { name: string }) => p.name).join(', ')}`),
    chalk.hex('#34d399')(`Default: ${config.getAll().ai.defaultProvider}`),
    '',
    chalk.dim('Get started:'),
    chalk.hex('#818cf8')('  azerclaw chat    — Interactive chat'),
    chalk.hex('#818cf8')('  azerclaw run     — Execute a task'),
    chalk.hex('#818cf8')('  azerclaw tui     — Premium terminal UI'),
    chalk.hex('#818cf8')('  azerclaw doctor  — Health check'),
  ]);
  console.log('');
}

function fishWarnMsg(msg: string): void {
  const chalk = require('chalk');
  const gradientString = require('gradient-string');
  console.log(gradientString(['#f59e0b', '#f97316'])(`  ><(((º>`) + chalk.hex('#fbbf24')(` ⚠ ${msg}`));
}

module.exports = { runOnboard };
