import { getConfigManager } from '../config/manager';
import type { NormalizedMessage } from './adapter';

export type SessionRoutingStrategy = 'channel' | 'platform_channel' | 'platform_sender';

export interface SessionRoutingRule {
  platform?: string;
  channelId?: string;
  senderId?: string;
  sessionId: string;
}

export interface SessionRoutingConfig {
  strategy?: SessionRoutingStrategy;
  rules?: SessionRoutingRule[];
}

function normalizeSegment(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'unknown';
}

function normalizeSessionId(input: string): string {
  return normalizeSegment(input).slice(0, 120);
}

function ruleMatches(message: NormalizedMessage, rule: SessionRoutingRule): boolean {
  if (rule.platform && rule.platform !== message.platform) return false;
  if (rule.channelId && rule.channelId !== message.channelId) return false;
  if (rule.senderId && rule.senderId !== message.senderId) return false;
  return true;
}

export function resolveSessionIdForMessage(
  message: NormalizedMessage,
  routingConfig?: SessionRoutingConfig
): string {
  const resolvedConfig = routingConfig ??
    (((getConfigManager().getAll().channels as any).routing || {}) as SessionRoutingConfig);

  const rules = resolvedConfig.rules || [];
  const matchedRule = rules.find(rule => ruleMatches(message, rule));
  if (matchedRule) {
    return normalizeSessionId(matchedRule.sessionId);
  }

  const strategy = resolvedConfig.strategy || 'platform_channel';
  const platform = normalizeSegment(message.platform || 'platform');
  const channelId = normalizeSegment(message.channelId || 'channel');
  const senderId = normalizeSegment(message.senderId || 'sender');

  switch (strategy) {
    case 'channel':
      return `channel_${channelId}`;
    case 'platform_sender':
      return `${platform}_${senderId}`;
    case 'platform_channel':
    default:
      return `${platform}_${channelId}`;
  }
}
