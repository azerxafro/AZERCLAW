/**
 * 🐟 AZERCLAW Slack Channel Adapter
 * Connects to Slack via the Web API + Socket Mode.
 */

import { ChannelAdapter, NormalizedMessage, SendOptions } from './adapter';
import { auditLog } from '../core/security';

export class SlackAdapter extends ChannelAdapter {
  readonly platform = 'slack';
  readonly displayName = 'Slack';
  private botToken = '';
  private appToken = '';
  private ws: any = null;
  private connected = false;
  private pingInterval: NodeJS.Timeout | null = null;
  private lastPongAt = 0;
  private savedConfig: Record<string, string> | null = null;

  async connect(config: Record<string, string>): Promise<void> {
    this.savedConfig = config;
    this.botToken = config.botToken;
    this.appToken = config.appToken;
    if (!this.botToken || !this.appToken) {
      throw new Error('Slack requires both botToken and appToken');
    }

    // Get WebSocket URL via Socket Mode
    const res = await fetch('https://slack.com/api/apps.connections.open', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.appToken}` },
    });
    const data = await res.json() as { ok: boolean; error?: string; url?: string };
    if (!data.ok) throw new Error(`Slack auth failed: ${data.error}`);

    const WebSocket = require('ws');
    const socket = new WebSocket(data.url);
    this.ws = socket;

    socket.on('open', () => {
      if (this.ws === socket) {
        this.connected = true;
        this.lastPongAt = Date.now();
        this.startKeepalive();
      }
      auditLog('SLACK_CONNECTED', 'Socket Mode active');
    });

    socket.on('pong', () => {
      if (this.ws === socket) {
        this.lastPongAt = Date.now();
      }
    });

    socket.on('message', (raw: string) => {
      if (this.ws !== socket) return;
      let payload: any;
      try {
        payload = JSON.parse(raw.toString());
      } catch (err: any) {
        auditLog('SLACK_PARSE_ERROR', err?.message || String(err));
        return;
      }
      try {
        this.handleSlackEvent(payload);
      } catch (err: any) {
        auditLog('SLACK_HANDLER_ERROR', err?.message || String(err));
      }
    });

    socket.on('close', () => {
      if (this.ws === socket) {
        this.connected = false;
        this.stopKeepalive();
      }
      auditLog('SLACK_DISCONNECTED', '');
    });

    socket.on('error', (err: Error) => {
      auditLog('SLACK_ERROR', err.message);
    });
  }

  private startKeepalive(): void {
    this.stopKeepalive();
    this.pingInterval = setInterval(() => {
      // If we haven’t seen a pong in 90s, treat the socket as dead and reconnect.
      if (Date.now() - this.lastPongAt > 90_000) {
        auditLog('SLACK_KEEPALIVE_TIMEOUT', 'No pong in 90s; reconnecting');
        try { this.ws?.terminate?.(); } catch { /* ignore */ }
        this.connected = false;
        this.stopKeepalive();
        if (this.savedConfig) {
          this.connect(this.savedConfig).catch((err: any) => {
            auditLog('SLACK_RECONNECT_FAILED', err?.message || String(err));
          });
        }
        return;
      }
      try { this.ws?.ping?.(); } catch { /* ignore */ }
    }, 30_000);
  }

  private stopKeepalive(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  async disconnect(): Promise<void> {
    this.stopKeepalive();
    if (this.ws) this.ws.close();
    this.connected = false;
  }

  async send(options: SendOptions): Promise<void> {
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: options.channelId,
        text: options.content,
        thread_ts: options.replyTo,
      }),
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  private handleSlackEvent(payload: any): void {
    // Acknowledge envelope
    if (payload.envelope_id) {
      this.ws?.send(JSON.stringify({ envelope_id: payload.envelope_id }));
    }

    const event = payload.payload?.event;
    if (!event || event.type !== 'message' || event.bot_id) return;

    const normalized: NormalizedMessage = {
      id: event.ts,
      platform: 'slack',
      channelId: event.channel,
      senderId: event.user || '',
      senderName: event.user || 'Unknown',
      content: event.text || '',
      attachments: (event.files || []).map((f: any) => ({
        type: 'file',
        url: f.url_private,
        name: f.name,
        mimeType: f.mimetype,
        size: f.size,
      })),
      timestamp: new Date(parseFloat(event.ts) * 1000),
      metadata: { threadTs: event.thread_ts, channelType: event.channel_type },
    };

    this.handleIncoming(normalized).catch((err: any) => {
      auditLog('SLACK_HANDLE_ERROR', err?.message || String(err));
    });
  }
}
