/**
 * 🐟 AZERCLAW Channel Adapter Base
 * Normalized interface for messenger platform integrations.
 * All messages from different platforms are normalized into a unified format.
 */

import { AgentRuntime, AgentEvent } from '../core/runtime';
import { auditLog } from '../core/security';

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
  protected agent: AgentRuntime | null = null;

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

    if (!this.agent) {
      this.agent = new AgentRuntime({
        sessionId: `${this.platform}_${message.channelId}`,
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
    }

    try {
      await this.agent.chat(message.content);
    } catch (e: any) {
      await this.send({
        channelId: message.channelId,
        content: `🐟 Error: ${e.message}`,
      });
    }
  }
}
