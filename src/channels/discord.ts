/**
 * 🐟 AZERCLAW Discord Channel Adapter
 * Connects to Discord via WebSocket (discord.js-like but lightweight).
 * Uses the WebSocket gateway directly to avoid heavy dependencies.
 */

import { ChannelAdapter, NormalizedMessage, SendOptions } from './adapter';
import { auditLog } from '../core/security';

export class DiscordAdapter extends ChannelAdapter {
  readonly platform = 'discord';
  readonly displayName = 'Discord';
  private ws: any = null;
  private token = '';
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private connected = false;
  private sequence: number | null = null;

  async connect(config: Record<string, string>): Promise<void> {
    this.token = config.token;
    if (!this.token) throw new Error('Discord bot token required');

    const WebSocket = require('ws');
    this.ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');

    this.ws.on('open', () => {
      auditLog('DISCORD_CONNECTED', 'WebSocket opened');
    });

    this.ws.on('message', (data: string) => {
      const payload = JSON.parse(data);
      this.handleGatewayEvent(payload);
    });

    this.ws.on('close', () => {
      this.connected = false;
      if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
      auditLog('DISCORD_DISCONNECTED', 'WebSocket closed');
    });

    this.ws.on('error', (err: Error) => {
      auditLog('DISCORD_ERROR', err.message);
    });
  }

  async disconnect(): Promise<void> {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.ws) this.ws.close();
    this.connected = false;
  }

  async send(options: SendOptions): Promise<void> {
    const url = `https://discord.com/api/v10/channels/${options.channelId}/messages`;
    const body: any = { content: options.content };
    if (options.replyTo) {
      body.message_reference = { message_id: options.replyTo };
    }

    await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  private handleGatewayEvent(payload: any): void {
    const { op, d, s, t } = payload;
    if (s) this.sequence = s;

    switch (op) {
      case 10: // Hello — start heartbeat
        this.startHeartbeat(d.heartbeat_interval);
        this.identify();
        break;
      case 11: // Heartbeat ACK
        break;
      case 0: // Dispatch
        if (t === 'READY') {
          this.connected = true;
          auditLog('DISCORD_READY', `Logged in as ${d.user?.username}`);
        }
        if (t === 'MESSAGE_CREATE') {
          // Don't respond to own messages
          if (d.author?.bot) return;
          
          const message: NormalizedMessage = {
            id: d.id,
            platform: 'discord',
            channelId: d.channel_id,
            senderId: d.author?.id || '',
            senderName: d.author?.username || 'Unknown',
            content: d.content || '',
            attachments: (d.attachments || []).map((a: any) => ({
              type: 'file',
              url: a.url,
              name: a.filename,
              size: a.size,
            })),
            timestamp: new Date(d.timestamp),
            metadata: { guildId: d.guild_id },
          };
          
          this.handleIncoming(message);
        }
        break;
    }
  }

  private startHeartbeat(interval: number): void {
    this.heartbeatInterval = setInterval(() => {
      this.ws?.send(JSON.stringify({ op: 1, d: this.sequence }));
    }, interval);
  }

  private identify(): void {
    this.ws?.send(JSON.stringify({
      op: 2,
      d: {
        token: this.token,
        intents: 513, // GUILDS + GUILD_MESSAGES
        properties: {
          os: process.platform,
          browser: 'azerclaw',
          device: 'azerclaw',
        },
      },
    }));
  }
}
