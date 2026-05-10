/**
 * 🐟 AZERCLAW Channel Adapter Base
 * Normalized interface for messenger platform integrations.
 * All messages from different platforms are normalized into a unified format.
 */

import { AgentRuntime, AgentEvent } from '../core/runtime';
import { auditLog } from '../core/security';
import { getConfigManager } from '../config/manager';
import { getPairingStore, PairingStore } from './pairing';
import { resolveSessionIdForMessage } from './routing';

// ─── Types ──────────────────────────────────────────────────────

export interface NormalizedMessage {
  id: string;
  platform: string;
  channelId: string;
  senderId: string;
  senderName: string;
  content: string;
  attachments: Attachment[];
  timestamp: Date;
  replyTo?: string;
  metadata: Record<string, unknown>;
}

export interface Attachment {
  type: 'image' | 'file' | 'audio' | 'video' | 'link';
  url: string;
  name?: string;
  mimeType?: string;
  size?: number;
}

export interface SendOptions {
  channelId: string;
  content: string;
  replyTo?: string;
  attachments?: Attachment[];
}

// ─── Base Adapter ───────────────────────────────────────────────

export abstract class ChannelAdapter {
  abstract readonly platform: string;
  abstract readonly displayName: string;
  protected agents: Map<string, AgentRuntime> = new Map();

  /**
   * Initialize the adapter with credentials.
   */
  abstract connect(config: Record<string, string>): Promise<void>;

  /**
   * Disconnect from the platform.
   */
  abstract disconnect(): Promise<void>;

  /**
   * Send a message to a channel.
   */
  abstract send(options: SendOptions): Promise<void>;

  /**
   * Check if the adapter is connected.
   */
  abstract isConnected(): boolean;

  /**
   * Handle an incoming message — routes to agent.
   */
  protected async handleIncoming(message: NormalizedMessage): Promise<void> {
    auditLog('CHANNEL_MSG_IN', `${this.platform}:${message.channelId} from ${message.senderName}`);

    const allowed = await this.enforceDmPolicy(message);
    if (!allowed) return;

    const sessionId = this.resolveSessionId(message);
    let agent = this.agents.get(sessionId);

    if (!agent) {
      agent = new AgentRuntime({
        sessionId,
        eventHandler: async (event: AgentEvent) => {
          if (event.type === 'response' && event.content) {
            await this.send({
              channelId: message.channelId,
              content: event.content,
              replyTo: message.id,
            });
          }
        },
      });
      this.agents.set(sessionId, agent);
      auditLog('CHANNEL_SESSION_ROUTE', `${this.platform}:${message.channelId} -> ${sessionId}`);
    }

    try {
      await agent.chat(message.content);
    } catch (e: any) {
      await this.send({
        channelId: message.channelId,
        content: `🐟 Error: ${e.message}`,
      });
    }
  }

  protected isDirectMessage(message: NormalizedMessage): boolean {
    if (this.platform === 'telegram') {
      return String(message.metadata.chatType || '').toLowerCase() === 'private';
    }

    if (this.platform === 'discord') {
      return !message.metadata.guildId;
    }

    if (this.platform === 'slack') {
      const channelType = String(message.metadata.channelType || '').toLowerCase();
      return channelType === 'im' || channelType === 'mpim';
    }

    return false;
  }

  protected async enforceDmPolicy(message: NormalizedMessage): Promise<boolean> {
    if (!this.isDirectMessage(message)) return true;

    const { dmPolicy, allowFrom } = this.getChannelSecurityConfig();
    const pairingStore = this.getPairingStore();

    const senderApproved = pairingStore.isApproved(this.platform, message.senderId, allowFrom);

    if (dmPolicy === 'closed') {
      await this.send({
        channelId: message.channelId,
        content: 'DM access is currently disabled for this channel.',
        replyTo: message.id,
      });
      auditLog('CHANNEL_DM_BLOCKED', `${this.platform}:${message.senderId} policy=closed`);
      return false;
    }

    if (dmPolicy === 'open') {
      if (allowFrom.length === 0 || senderApproved) return true;

      await this.send({
        channelId: message.channelId,
        content: 'DM access is restricted. Ask the operator to allowlist your account.',
        replyTo: message.id,
      });
      auditLog('CHANNEL_DM_BLOCKED', `${this.platform}:${message.senderId} policy=open allowlist`);
      return false;
    }

    // pairing (default)
    if (senderApproved) return true;

    const pending = pairingStore.requestPairing({
      platform: this.platform,
      senderId: message.senderId,
      senderName: message.senderName,
      channelId: message.channelId,
    });

    await this.send({
      channelId: message.channelId,
      replyTo: message.id,
      content: [
        'Pairing required before I can respond in DMs.',
        `Approve with: azerclaw pairing approve ${this.platform} ${pending.code}`,
      ].join('\n'),
    });
    auditLog('CHANNEL_DM_BLOCKED', `${this.platform}:${message.senderId} policy=pairing code=${pending.code}`);
    return false;
  }

  protected getPairingStore(): PairingStore {
    return getPairingStore();
  }

  protected getChannelSecurityConfig(): { dmPolicy: 'pairing' | 'open' | 'closed'; allowFrom: string[] } {
    const channelsConfig = getConfigManager().getAll().channels as any;
    const channelConfig = channelsConfig?.[this.platform] || {};
    const dmPolicy = channelConfig.dmPolicy === 'open' || channelConfig.dmPolicy === 'closed'
      ? channelConfig.dmPolicy
      : 'pairing';
    const allowFrom: string[] = Array.isArray(channelConfig.allowFrom) ? channelConfig.allowFrom : [];
    return { dmPolicy, allowFrom };
  }

  protected resolveSessionId(message: NormalizedMessage): string {
    return resolveSessionIdForMessage(message);
  }
}
