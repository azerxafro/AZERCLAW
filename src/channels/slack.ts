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

  async connect(config: Record<string, string>): Promise<void> {
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
    const data = await res.json() as any;
    if (!data.ok) throw new Error(`Slack auth failed: ${data.error}`);

    const WebSocket = require('ws');
    this.ws = new WebSocket(data.url);

    this.ws.on('open', () => {
      this.connected = true;
      auditLog('SLACK_CONNECTED', 'Socket Mode active');
    });

    this.ws.on('message', (raw: string) => {
      const payload = JSON.parse(raw);
      this.handleSlackEvent(payload);
    });

    this.ws.on('close', () => {
      this.connected = false;
      auditLog('SLACK_DISCONNECTED', '');
    });
  }

  async disconnect(): Promise<void> {
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

    this.handleIncoming(normalized);
  }
}
