const chalk = require('chalk');
const { getConfigManager } = require('../../config/manager');
const { resolveSandboxMode } = require('../../core/sandbox');
const { fishSuccess, fishError, fishBox, fishInfo } = require('../animations/fish');

const VALID_MODES = ['off', 'non-main', 'all'];

function unique(list: string[]): string[] {
  return Array.from(new Set(list.map(v => String(v || '').trim()).filter(Boolean)));
}

export function sandboxStatus(): void {
  const config = getConfigManager().getAll();
  const agent = config.agent;
  const mode = resolveSandboxMode(agent.sandboxMode);
  const allowed = Array.isArray(agent.sandboxAllowedTools) ? agent.sandboxAllowedTools : [];
  const denied = Array.isArray(agent.sandboxDeniedTools) ? agent.sandboxDeniedTools : [];

  fishBox('🧱 Sandbox Isolation', [
    '',
    `  Mode:    ${chalk.hex('#34d399')(mode)}`,
    `  Allowed: ${chalk.dim(allowed.join(', ') || 'none (all except denied)')}`,
    `  Denied:  ${chalk.dim(denied.join(', ') || 'none')}`,
    '',
    chalk.dim('Main sessions are session IDs "main" or "main:*".'),
    '',
  ]);
}

export function setSandboxMode(mode: string): void {
  if (!VALID_MODES.includes(mode)) {
    fishError(`Invalid sandbox mode: ${mode}. Use one of: ${VALID_MODES.join(', ')}`);
    return;
  }

  const config = getConfigManager();
  config.set('agent.sandboxMode', mode);
  fishSuccess(`Sandbox mode set to ${mode}`);
}

export function addSandboxAllowedTool(toolName: string): void {
  const config = getConfigManager();
  const all = config.getAll();
  const current = Array.isArray(all.agent.sandboxAllowedTools)
    ? all.agent.sandboxAllowedTools
    : [];
  const next = unique([...current, toolName]);
  config.set('agent.sandboxAllowedTools', next);
  fishSuccess(`Added allowed tool: ${toolName}`);
}

export function removeSandboxAllowedTool(toolName: string): void {
  const config = getConfigManager();
  const all = config.getAll();
  const current = Array.isArray(all.agent.sandboxAllowedTools)
    ? all.agent.sandboxAllowedTools
    : [];
  const next = current.filter((t: string) => t !== toolName);
  if (next.length === current.length) {
    fishError(`Tool not in allowed list: ${toolName}`);
    return;
  }
  config.set('agent.sandboxAllowedTools', next);
  fishInfo(`Removed allowed tool: ${toolName}`);
}

export function addSandboxDeniedTool(toolName: string): void {
  const config = getConfigManager();
  const all = config.getAll();
  const current = Array.isArray(all.agent.sandboxDeniedTools)
    ? all.agent.sandboxDeniedTools
    : [];
  const next = unique([...current, toolName]);
  config.set('agent.sandboxDeniedTools', next);
  fishSuccess(`Added denied tool: ${toolName}`);
}

export function removeSandboxDeniedTool(toolName: string): void {
  const config = getConfigManager();
  const all = config.getAll();
  const current = Array.isArray(all.agent.sandboxDeniedTools)
    ? all.agent.sandboxDeniedTools
    : [];
  const next = current.filter((t: string) => t !== toolName);
  if (next.length === current.length) {
    fishError(`Tool not in denied list: ${toolName}`);
    return;
  }
  config.set('agent.sandboxDeniedTools', next);
  fishInfo(`Removed denied tool: ${toolName}`);
}

module.exports = {
  sandboxStatus,
  setSandboxMode,
  addSandboxAllowedTool,
  removeSandboxAllowedTool,
  addSandboxDeniedTool,
  removeSandboxDeniedTool,
};
