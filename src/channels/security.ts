const CHANNEL_PLATFORMS = ['discord', 'telegram', 'slack'] as const;
const VALID_DM_POLICIES = ['pairing', 'open', 'closed'] as const;

export type SupportedChannelPlatform = typeof CHANNEL_PLATFORMS[number];
export type DmPolicy = typeof VALID_DM_POLICIES[number];

export interface DmPolicyIssue {
  platform: SupportedChannelPlatform;
  severity: 'warn' | 'fail';
  message: string;
}

export interface DmPolicyAuditResult {
  issues: DmPolicyIssue[];
  warnings: DmPolicyIssue[];
  failures: DmPolicyIssue[];
}

function getChannelConfig(channelsConfig: any, platform: SupportedChannelPlatform): any {
  return channelsConfig?.[platform] || {};
}

function isValidPolicy(policy: string): policy is DmPolicy {
  return (VALID_DM_POLICIES as readonly string[]).includes(policy);
}

export function auditDmPolicies(channelsConfig: any): DmPolicyAuditResult {
  const issues: DmPolicyIssue[] = [];

  for (const platform of CHANNEL_PLATFORMS) {
    const channelConfig = getChannelConfig(channelsConfig, platform);
    if (!channelConfig.enabled) continue;

    const policy = String(channelConfig.dmPolicy || 'pairing');
    const allowFrom = Array.isArray(channelConfig.allowFrom) ? channelConfig.allowFrom : [];

    if (!isValidPolicy(policy)) {
      issues.push({
        platform,
        severity: 'fail',
        message: `${platform}: invalid dmPolicy "${policy}"`,
      });
      continue;
    }

    if (policy === 'open' && (allowFrom.length === 0 || allowFrom.includes('*'))) {
      issues.push({
        platform,
        severity: 'fail',
        message: `${platform}: dmPolicy=open allows unrestricted inbound DMs`,
      });
      continue;
    }

    if (policy === 'open' && allowFrom.length > 0) {
      issues.push({
        platform,
        severity: 'warn',
        message: `${platform}: dmPolicy=open with allowlist (intentional exposure recommended to review)`,
      });
    }

    if (policy === 'pairing' && allowFrom.includes('*')) {
      issues.push({
        platform,
        severity: 'warn',
        message: `${platform}: allowFrom=* bypasses pairing protection`,
      });
    }
  }

  return {
    issues,
    warnings: issues.filter(i => i.severity === 'warn'),
    failures: issues.filter(i => i.severity === 'fail'),
  };
}

export function applySafeDmDefaults(configManager: any): string[] {
  const channelsConfig = configManager.getAll().channels || {};
  const changes: string[] = [];

  for (const platform of CHANNEL_PLATFORMS) {
    const channelConfig = getChannelConfig(channelsConfig, platform);
    if (!channelConfig.enabled) continue;

    const policy = String(channelConfig.dmPolicy || 'pairing');
    const allowFrom = Array.isArray(channelConfig.allowFrom) ? channelConfig.allowFrom : [];
    const invalidPolicy = !isValidPolicy(policy);
    const riskyOpen = policy === 'open' && (allowFrom.length === 0 || allowFrom.includes('*'));

    if (invalidPolicy || riskyOpen) {
      configManager.set(`channels.${platform}.dmPolicy`, 'pairing');
      const sanitizedAllow = allowFrom.filter((x: string) => x !== '*');
      if (sanitizedAllow.length !== allowFrom.length) {
        configManager.set(`channels.${platform}.allowFrom`, sanitizedAllow);
      }
      changes.push(`${platform}: dmPolicy -> pairing`);
    }
  }

  return changes;
}
