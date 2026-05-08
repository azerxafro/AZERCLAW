/**
 * 🐟 AZERCLAW Telegram Channel Adapter
 * Connects to Telegram via the Bot API (long polling).
 */

import { ChannelAdapter, NormalizedMessage, SendOptions } from './adapter';
import { auditLog } from '../core/security';

export class TelegramAdapter extends ChannelAdapter {
  readonly platform = 'telegram';
  readonly displayName = 'Telegram';
  private token = '';
  private polling = false;
  private offset = 0;
  private pollTimer: NodeJS.Timeout | null = null;

  private get baseUrl(): string {
    return `https://api.telegram.org/bot${this.token}`;
  }

  async connect(config: Record<string, string>): Promise<void> {
    this.token = config.token;
    if (!this.token) throw new Error('Telegram bot token required');

    // Verify token
    const res = await fetch(`${this.baseUrl}/getMe`);
    const data = await res.json() as any;
    if (!data.ok) throw new Error(`Telegram auth failed: ${data.description}`);

    auditLog('TELEGRAM_CONNECTED', `Bot: @${data.result.username}`);
    this.polling = true;
    this.pollUpdates();
  }

  async disconnect(): Promise<void> {
    this.polling = false;
    if (this.pollTimer) clearTimeout(this.pollTimer);
  }

  async send(options: SendOptions): Promise<void> {
    await fetch(`${this.baseUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: options.channelId,
        text: options.content,
        reply_to_message_id: options.replyTo ? parseInt(options.replyTo) : undefined,
        parse_mode: 'Markdown',
      }),
    });
  }

  isConnected(): boolean {
    return this.polling;
  }

  private async pollUpdates(): Promise<void> {
    if (!this.polling) return;

    try {
      const res = await fetch(`${this.baseUrl}/getUpdates?offset=${this.offset}&timeout=30`);
      const data = await res.json() as any;

      if (data.ok && data.result) {
        for (const update of data.result) {
          this.offset = update.update_id + 1;
          if (update.message?.text) {
            const msg = update.message;
            const normalized: NormalizedMessage = {
              id: String(msg.message_id),
              platform: 'telegram',
              channelId: String(msg.chat.id),
              senderId: String(msg.from?.id || ''),
              senderName: msg.from?.first_name || 'Unknown',
              content: msg.text,
              attachments: [],
              timestamp: new Date(msg.date * 1000),
              metadata: { chatType: msg.chat.type },
            };
            this.handleIncoming(normalized);
          }
        }
      }
    } catch (e: any) {
      auditLog('TELEGRAM_ERROR', e.message);
    }

    this.pollTimer = setTimeout(() => this.pollUpdates(), 1000);
  }
}
