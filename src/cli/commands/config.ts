/**
 * 🐟 AZERCLAW Config Command
 * Manage configuration from the CLI.
 * Reads from the shared ConfigManager — synchronized with in-session commands.
 */

const chalk = require('chalk');
const gradientString = require('gradient-string');
const { getConfigManager } = require('../../config/manager');
const { fishSuccess, fishError, fishInfo, fishBox } = require('../animations/fish');
const { PROVIDER_LABELS } = require('./settings');
const { ProviderName } = require('../../config/schema');

const LUXE = gradientString(['#c084fc', '#818cf8', '#60a5fa', '#34d399']);

export function configGet(keyPath: string): void {
  const config = getConfigManager();
  const value = config.get(keyPath);
  
  if (value === undefined) {
    fishError(`Key not found: ${keyPath}`);
    return;
  }

  if (typeof value === 'object') {
    console.log('');
    console.log(LUXE(`  ${keyPath}:`));
    console.log(chalk.hex('#e2e8f0')(JSON.stringify(value, null, 2).split('\n').map((l: string) => `  ${l}`).join('\n')));
    console.log('');
  } else {
    // Mask API keys
    const displayValue = keyPath.toLowerCase().includes('apikey') || keyPath.toLowerCase().includes('key')
      ? maskKey(String(value))
      : String(value);
    fishInfo(`${keyPath} = ${displayValue}`);
  }
}

export function configSet(keyPath: string, value: string): void {
  const config = getConfigManager();
  
  // Auto-parse booleans and numbers
  let parsed: unknown = value;
  if (value === 'true') parsed = true;
  else if (value === 'false') parsed = false;
  else if (!isNaN(Number(value)) && value !== '') parsed = Number(value);

  try {
    config.set(keyPath, parsed);
    const displayValue = keyPath.toLowerCase().includes('key') ? maskKey(value) : value;
    fishSuccess(`Set ${keyPath} = ${displayValue}`);
  } catch (error: any) {
    fishError(`Failed to set: ${error.message}`);
  }
}

export function configList(): void {
  const config = getConfigManager();
  const all = config.getAll();
  const status = config.getStatus();
  const fallback = config.getFallbackProvider();
  
  fishBox('🐟 AZERCLAW Configuration', [
    '',
    chalk.hex('#818cf8').bold('AI Provider Settings:'),
    `  Default:    ${chalk.hex('#34d399')(PROVIDER_LABELS[all.ai.defaultProvider] || all.ai.defaultProvider)}`,
    `  Model:      ${chalk.hex('#34d399')(all.ai.providers[all.ai.defaultProvider as typeof ProviderName]?.defaultModel || 'auto')}`,
    `  Fallback:   ${chalk.hex('#34d399')(fallback ? `${PROVIDER_LABELS[fallback.name] || fallback.name} (${fallback.config.defaultModel})` : chalk.dim('none'))}`,
    `  Chain:      ${chalk.dim(all.ai.fallbackChain.join(' → '))}`,
    `  Max Tokens: ${chalk.dim(String(all.ai.maxTokens))}`,
    `  Temperature:${chalk.dim(String(all.ai.temperature))}`,
    '',
    chalk.hex('#818cf8').bold('Configured Providers:'),
    ...Object.entries(all.ai.providers).map(([name, prov]: [string, unknown]) => {
      const p = prov as Record<string, unknown>;
      const isDefault = name === all.ai.defaultProvider;
      const isFallback = fallback?.name === name;
      const status = p.enabled ? chalk.hex('#34d399')('●') : chalk.hex('#6b7280')('○');
      const key = p.apiKey ? maskKey(p.apiKey as string) : (name === 'ollama' ? chalk.dim('local') : chalk.dim('no key'));
      const badge = isDefault ? chalk.hex('#34d399')(' [primary]') : isFallback ? chalk.hex('#06b6d4')(' [fallback]') : '';
      return `  ${status} ${chalk.hex('#e2e8f0')((PROVIDER_LABELS[name] || name).padEnd(16))} ${key}${badge}`;
    }),
    '',
    chalk.hex('#818cf8').bold('Agent Settings:'),
    `  Name:            ${chalk.dim(all.agent.name)}`,
    `  Max Iterations:  ${chalk.dim(String(all.agent.maxIterations))}`,
    `  Approval Required: ${chalk.dim(String(all.agent.approvalRequired))}`,
    `  Sandbox Mode:    ${chalk.dim(String(all.agent.sandboxMode))}`,
    `  Sandbox Allowed: ${chalk.dim((all.agent.sandboxAllowedTools || []).join(', ') || 'none')}`,
    `  Sandbox Denied:  ${chalk.dim((all.agent.sandboxDeniedTools || []).join(', ') || 'none')}`,
    '',
    chalk.hex('#818cf8').bold('Permissions:'),
    `  Auto-Approve:    ${chalk.dim((all.permissions?.autoApprove || []).join(', ') || 'none')}`,
    `  Require Approval:${chalk.dim((all.permissions?.requireApproval || []).join(', ') || 'none')}`,
    '',
    chalk.hex('#818cf8').bold('Auth & Status:'),
    `  Auth Route:   ${chalk.dim(status.authRoute === 'env_var' ? 'Environment Variable' : status.authRoute === 'api_key' ? 'Config File' : 'Not configured')}`,
    `  Project:      ${chalk.dim(status.projectConfigured ? 'Configured' : 'Not initialized')}`,
    '',
    chalk.hex('#818cf8').bold('UI Settings:'),
    `  Theme: ${chalk.dim(all.ui.theme)}`,
    `  Splash: ${chalk.dim(String(all.ui.showSplash))}`,
    '',
    chalk.hex('#818cf8').bold('Channel Security:'),
    `  Discord DM:  ${chalk.dim(all.channels.discord?.dmPolicy || 'pairing')} | allowFrom=${chalk.dim((all.channels.discord?.allowFrom || []).join(', ') || 'empty')}`,
    `  Telegram DM: ${chalk.dim(all.channels.telegram?.dmPolicy || 'pairing')} | allowFrom=${chalk.dim((all.channels.telegram?.allowFrom || []).join(', ') || 'empty')}`,
    `  Slack DM:    ${chalk.dim(all.channels.slack?.dmPolicy || 'pairing')} | allowFrom=${chalk.dim((all.channels.slack?.allowFrom || []).join(', ') || 'empty')}`,
    `  Routing:     ${chalk.dim(all.channels.routing?.strategy || 'platform_channel')} (${chalk.dim(String((all.channels.routing?.rules || []).length))} rules)`,
    '',
    chalk.dim(`Config: ${config.paths.configFile}`),
  ]);
}

export function configReset(): void {
  const config = getConfigManager();
  config.reset();
  fishSuccess('Configuration reset to defaults');
}

function maskKey(key: string): string {
  if (!key || key.length < 8) return chalk.dim('****');
  return chalk.dim(`${key.slice(0, 4)}${'*'.repeat(Math.min(20, key.length - 8))}${key.slice(-4)}`);
}
