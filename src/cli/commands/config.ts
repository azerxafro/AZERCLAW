/**
 * 🐟 AZERCLAW Config Command
 * Manage configuration from the CLI.
 */

const chalk = require('chalk');
const gradientString = require('gradient-string');
const { getConfigManager } = require('../../config/manager');
const { fishSuccess, fishError, fishInfo, fishBox } = require('../animations/fish');

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
  
  fishBox('🐟 AZERCLAW Configuration', [
    '',
    chalk.hex('#818cf8')('AI Provider Settings:'),
    `  Default: ${chalk.hex('#34d399')(all.ai.defaultProvider)}`,
    `  Fallback: ${chalk.dim(all.ai.fallbackChain.join(' → '))}`,
    `  Max Tokens: ${chalk.dim(String(all.ai.maxTokens))}`,
    `  Temperature: ${chalk.dim(String(all.ai.temperature))}`,
    '',
    chalk.hex('#818cf8')('Configured Providers:'),
    ...Object.entries(all.ai.providers).map(([name, prov]: [string, any]) => {
      const status = prov.enabled ? chalk.hex('#34d399')('●') : chalk.hex('#6b7280')('○');
      const key = prov.apiKey ? maskKey(prov.apiKey) : chalk.dim('no key');
      return `  ${status} ${chalk.hex('#e2e8f0')(name.padEnd(12))} ${key}`;
    }),
    '',
    chalk.hex('#818cf8')('Agent Settings:'),
    `  Name: ${chalk.dim(all.agent.name)}`,
    `  Max Iterations: ${chalk.dim(String(all.agent.maxIterations))}`,
    `  Approval Required: ${chalk.dim(String(all.agent.approvalRequired))}`,
    '',
    chalk.hex('#818cf8')('UI Settings:'),
    `  Theme: ${chalk.dim(all.ui.theme)}`,
    `  Splash: ${chalk.dim(String(all.ui.showSplash))}`,
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

module.exports = { configGet, configSet, configList, configReset };
