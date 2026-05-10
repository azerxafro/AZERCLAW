const chalk = require('chalk');
const { getConfigManager } = require('../../config/manager');
const { fishSuccess, fishError, fishInfo, fishBox } = require('../animations/fish');

const CHANNELS = ['discord', 'telegram', 'slack'];
const DM_POLICIES = ['pairing', 'open', 'closed'];
const ROUTING_STRATEGIES = ['channel', 'platform_channel', 'platform_sender'];

function isValidChannel(platform: string): boolean {
  return CHANNELS.includes(platform);
}

function maskAllowlist(values: string[]): string {
  if (values.length === 0) return chalk.dim('(empty)');
  return values.join(', ');
}

export function channelsConfigList(): void {
  const config = getConfigManager().getAll();
  const channels = config.channels as any;
  const lines: string[] = ['', chalk.hex('#818cf8').bold('DM Policies')];

  for (const platform of CHANNELS) {
    const c = channels?.[platform] || {};
    lines.push(
      `  ${platform.padEnd(10)} enabled=${String(!!c.enabled).padEnd(5)} ` +
      `policy=${String(c.dmPolicy || 'pairing').padEnd(8)} allowFrom=${maskAllowlist(Array.isArray(c.allowFrom) ? c.allowFrom : [])}`
    );
  }

  const routing = channels?.routing || {};
  const rules = Array.isArray(routing.rules) ? routing.rules : [];
  lines.push('');
  lines.push(chalk.hex('#818cf8').bold(`Routing (${rules.length} rules)`));
  lines.push(`  strategy=${routing.strategy || 'platform_channel'}`);

  if (rules.length === 0) {
    lines.push(`  ${chalk.dim('no explicit rules')}`);
  } else {
    for (const rule of rules) {
      lines.push(
        `  ${chalk.hex('#34d399')('●')} session=${rule.sessionId} ` +
        `${chalk.dim(`platform=${rule.platform || '*'} channel=${rule.channelId || '*'} sender=${rule.senderId || '*'}`)}`
      );
    }
  }

  fishBox('🔐 Channel Security & Routing', lines);
}

export function setChannelDmPolicy(platform: string, policy: string): void {
  if (!isValidChannel(platform)) {
    fishError(`Invalid platform: ${platform}. Use one of: ${CHANNELS.join(', ')}`);
    return;
  }
  if (!DM_POLICIES.includes(policy)) {
    fishError(`Invalid dmPolicy: ${policy}. Use one of: ${DM_POLICIES.join(', ')}`);
    return;
  }

  const config = getConfigManager();
  config.set(`channels.${platform}.dmPolicy`, policy);
  fishSuccess(`Set channels.${platform}.dmPolicy = ${policy}`);
}

export function addChannelAllowFrom(platform: string, senderId: string): void {
  if (!isValidChannel(platform)) {
    fishError(`Invalid platform: ${platform}. Use one of: ${CHANNELS.join(', ')}`);
    return;
  }

  const config = getConfigManager();
  const channels = config.getAll().channels as any;
  const current = Array.isArray(channels?.[platform]?.allowFrom) ? channels[platform].allowFrom : [];
  if (current.includes(senderId)) {
    fishInfo(`Sender already allowed on ${platform}: ${senderId}`);
    return;
  }

  config.set(`channels.${platform}.allowFrom`, [...current, senderId]);
  fishSuccess(`Added ${senderId} to channels.${platform}.allowFrom`);
}

export function removeChannelAllowFrom(platform: string, senderId: string): void {
  if (!isValidChannel(platform)) {
    fishError(`Invalid platform: ${platform}. Use one of: ${CHANNELS.join(', ')}`);
    return;
  }

  const config = getConfigManager();
  const channels = config.getAll().channels as any;
  const current = Array.isArray(channels?.[platform]?.allowFrom) ? channels[platform].allowFrom : [];
  const next = current.filter((id: string) => id !== senderId);

  if (next.length === current.length) {
    fishError(`Sender not found in allowFrom for ${platform}: ${senderId}`);
    return;
  }

  config.set(`channels.${platform}.allowFrom`, next);
  fishSuccess(`Removed ${senderId} from channels.${platform}.allowFrom`);
}

export function listChannelAllowFrom(platform: string): void {
  if (!isValidChannel(platform)) {
    fishError(`Invalid platform: ${platform}. Use one of: ${CHANNELS.join(', ')}`);
    return;
  }

  const config = getConfigManager().getAll();
  const allowFrom = ((config.channels as any)?.[platform]?.allowFrom || []) as string[];
  fishBox(`Allowlist — ${platform}`, [
    '',
    ...(allowFrom.length > 0 ? allowFrom.map(id => `  ${chalk.hex('#34d399')('●')} ${id}`) : [`  ${chalk.dim('empty')}`]),
    '',
  ]);
}

export function setRoutingStrategy(strategy: string): void {
  if (!ROUTING_STRATEGIES.includes(strategy)) {
    fishError(`Invalid strategy: ${strategy}. Use one of: ${ROUTING_STRATEGIES.join(', ')}`);
    return;
  }

  const config = getConfigManager();
  config.set('channels.routing.strategy', strategy);
  fishSuccess(`Set channels.routing.strategy = ${strategy}`);
}

export function addRoutingRule(
  sessionId: string,
  opts: { platform?: string; channel?: string; sender?: string }
): void {
  if (!opts.platform && !opts.channel && !opts.sender) {
    fishError('Routing rule needs at least one matcher: --platform, --channel, or --sender');
    return;
  }

  if (opts.platform && !isValidChannel(opts.platform)) {
    fishError(`Invalid platform: ${opts.platform}. Use one of: ${CHANNELS.join(', ')}`);
    return;
  }

  const config = getConfigManager();
  const channels = config.getAll().channels as any;
  const routing = channels?.routing || {};
  const rules = Array.isArray(routing.rules) ? routing.rules : [];

  const nextRules = [
    ...rules,
    {
      sessionId,
      platform: opts.platform || undefined,
      channelId: opts.channel || undefined,
      senderId: opts.sender || undefined,
    },
  ];

  config.set('channels.routing.rules', nextRules);
  fishSuccess(`Added routing rule for session ${sessionId}`);
}

export function removeRoutingRule(
  sessionId: string,
  opts: { platform?: string; channel?: string; sender?: string }
): void {
  const config = getConfigManager();
  const channels = config.getAll().channels as any;
  const rules = Array.isArray(channels?.routing?.rules) ? channels.routing.rules : [];

  const nextRules = rules.filter((rule: any) => {
    if (rule.sessionId !== sessionId) return true;
    if (opts.platform && rule.platform !== opts.platform) return true;
    if (opts.channel && rule.channelId !== opts.channel) return true;
    if (opts.sender && rule.senderId !== opts.sender) return true;
    return false;
  });

  if (nextRules.length === rules.length) {
    fishError(`No matching routing rule found for session ${sessionId}`);
    return;
  }

  config.set('channels.routing.rules', nextRules);
  fishSuccess(`Removed routing rule(s) for session ${sessionId}`);
}

module.exports = {
  channelsConfigList,
  setChannelDmPolicy,
  addChannelAllowFrom,
  removeChannelAllowFrom,
  listChannelAllowFrom,
  setRoutingStrategy,
  addRoutingRule,
  removeRoutingRule,
};
