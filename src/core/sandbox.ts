import { ToolDefinition } from '../providers/base';

export type SandboxMode = 'off' | 'non-main' | 'all';

export const DEFAULT_SANDBOX_ALLOWED_TOOLS = [
  'read_file',
  'list_directory',
  'search_files',
  'analyze_code',
  'web_search',
];

export const DEFAULT_SANDBOX_DENIED_TOOLS = [
  'run_shell',
  'write_file',
  'spawn_sub_agent',
];

export interface SandboxPolicyConfig {
  sandboxMode?: boolean | SandboxMode;
  sandboxAllowedTools?: string[];
  sandboxDeniedTools?: string[];
}

export interface SandboxAuditIssue {
  severity: 'warn' | 'fail';
  message: string;
}

export interface SandboxAuditResult {
  issues: SandboxAuditIssue[];
  warnings: SandboxAuditIssue[];
  failures: SandboxAuditIssue[];
}

function normalizeToolList(list: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(list)) return [...fallback];
  return list
    .map(item => String(item || '').trim())
    .filter(Boolean);
}

export function resolveSandboxMode(mode: boolean | SandboxMode | undefined): SandboxMode {
  if (mode === true) return 'all';     // backward compatibility
  if (mode === false || mode === undefined) return 'off';
  if (mode === 'all' || mode === 'non-main') return mode;
  return 'off';
}

export function isMainSession(sessionId: string): boolean {
  const normalized = String(sessionId || '').trim().toLowerCase();
  return normalized === 'main' || normalized.startsWith('main:');
}

export function shouldSandboxSession(sessionId: string, mode: SandboxMode): boolean {
  if (mode === 'off') return false;
  if (mode === 'all') return true;
  return !isMainSession(sessionId);
}

export function getSandboxToolPolicy(agentConfig: SandboxPolicyConfig): {
  mode: SandboxMode;
  allowed: Set<string>;
  denied: Set<string>;
} {
  const mode = resolveSandboxMode(agentConfig.sandboxMode);
  const allowedList = normalizeToolList(agentConfig.sandboxAllowedTools, DEFAULT_SANDBOX_ALLOWED_TOOLS);
  const deniedList = normalizeToolList(agentConfig.sandboxDeniedTools, DEFAULT_SANDBOX_DENIED_TOOLS);

  return {
    mode,
    allowed: new Set(allowedList),
    denied: new Set(deniedList),
  };
}

export function isToolAllowedInSession(toolName: string, sessionId: string, agentConfig: SandboxPolicyConfig): boolean {
  const policy = getSandboxToolPolicy(agentConfig);
  if (!shouldSandboxSession(sessionId, policy.mode)) return true;

  if (policy.denied.has(toolName)) return false;
  if (policy.allowed.size === 0) return true;
  return policy.allowed.has(toolName);
}

export function filterToolDefinitionsForSession(
  definitions: ToolDefinition[],
  sessionId: string,
  agentConfig: SandboxPolicyConfig
): ToolDefinition[] {
  return definitions.filter(def => isToolAllowedInSession(def.function.name, sessionId, agentConfig));
}

export function auditSandboxPosture(config: { agent?: SandboxPolicyConfig; channels?: any }): SandboxAuditResult {
  const agent = config.agent || {};
  const channels = config.channels || {};
  const mode = resolveSandboxMode(agent.sandboxMode);
  const enabledChannelCount = ['discord', 'telegram', 'slack']
    .filter((platform) => channels?.[platform]?.enabled)
    .length;

  const issues: SandboxAuditIssue[] = [];
  const denied = normalizeToolList(agent.sandboxDeniedTools, DEFAULT_SANDBOX_DENIED_TOOLS);

  if (enabledChannelCount > 0 && mode === 'off') {
    issues.push({
      severity: 'fail',
      message: `Sandbox mode is off while ${enabledChannelCount} channel(s) are enabled`,
    });
  }

  if (mode === 'non-main' || mode === 'all') {
    const requiredDenied = ['run_shell', 'write_file'];
    const missing = requiredDenied.filter(tool => !denied.includes(tool));
    if (missing.length > 0) {
      issues.push({
        severity: 'warn',
        message: `Sandbox denylist missing recommended tool(s): ${missing.join(', ')}`,
      });
    }
  }

  return {
    issues,
    warnings: issues.filter(i => i.severity === 'warn'),
    failures: issues.filter(i => i.severity === 'fail'),
  };
}

export function applySafeSandboxDefaults(configManager: any): string[] {
  const all = configManager.getAll();
  const agent = all.agent || {};
  const mode = resolveSandboxMode(agent.sandboxMode);
  const changes: string[] = [];

  if (mode === 'off') {
    configManager.set('agent.sandboxMode', 'non-main');
    changes.push('agent.sandboxMode -> non-main');
  }

  const deny = normalizeToolList(agent.sandboxDeniedTools, DEFAULT_SANDBOX_DENIED_TOOLS);
  const mergedDeny = Array.from(new Set([...deny, ...DEFAULT_SANDBOX_DENIED_TOOLS]));
  if (JSON.stringify(deny.sort()) !== JSON.stringify([...mergedDeny].sort())) {
    configManager.set('agent.sandboxDeniedTools', mergedDeny);
    changes.push('agent.sandboxDeniedTools hardened');
  }

  const allow = normalizeToolList(agent.sandboxAllowedTools, DEFAULT_SANDBOX_ALLOWED_TOOLS);
  if (allow.length === 0) {
    configManager.set('agent.sandboxAllowedTools', DEFAULT_SANDBOX_ALLOWED_TOOLS);
    changes.push('agent.sandboxAllowedTools reset to defaults');
  }

  return changes;
}
