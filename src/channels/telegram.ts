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
    const data = await res.json() as { ok: boolean; result?: { username?: string }; description?: string };
    if (!data.ok) throw new Error(`Telegram auth failed: ${data.description}`);

    auditLog('TELEGRAM_CONNECTED', `Bot: @${data.result?.username}`);
    this.polling = true;
    this.pollUpdates();
  }

  async disconnect(): Promise<void> {
    this.polling = false;
    if (this.pollTimer) clearTimeout(this.pollTimer);
  }

  async send(options: SendOptions): Promise<void> {
    const res = await fetch(`${this.baseUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: options.channelId,
        text: options.content,
        reply_to_message_id: options.replyTo ? parseInt(options.replyTo) : undefined,
        parse_mode: 'Markdown',
      }),
    });

    if (!res.ok) {
      let errDescription = '';
      try {
        const data = await res.json() as { ok: boolean; description?: string };
        errDescription = data.description || '';
      } catch { /* ignore */ }

      if (errDescription.includes("can't parse entities") || errDescription.includes("can't find end of")) {
        // Fall back to sending as plain text if Markdown formatting fails
        const retryRes = await fetch(`${this.baseUrl}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: options.channelId,
            text: options.content,
            reply_to_message_id: options.replyTo ? parseInt(options.replyTo) : undefined,
          }),
        });
        if (!retryRes.ok) {
          throw new Error(`Telegram send fallback failed: ${retryRes.statusText}`);
        }
      } else {
        throw new Error(`Telegram send failed: ${errDescription || res.statusText}`);
      }
    }
  }

  isConnected(): boolean {
    return this.polling;
  }

  private consecutiveErrors = 0;

  private async pollUpdates(): Promise<void> {
    if (!this.polling) return;

    let delay = 1000;
    try {
      const res = await fetch(`${this.baseUrl}/getUpdates?offset=${this.offset}&timeout=30`);
      const data = await res.json() as { ok: boolean; description?: string; error_code?: number; result?: Record<string, unknown>[] };

      if (!data.ok) {
        throw new Error(`Telegram API Error: ${data.description || 'Unknown error'} (${data.error_code || 'no code'})`);
      }

      // Successful poll — reset backoff.
      this.consecutiveErrors = 0;

      if (data.ok && data.result) {
        for (const update of data.result) {
          this.offset = (update.update_id as number) + 1;
          const msg = update.message as Record<string, unknown>;
          if (msg?.text) {
            const from = msg.from as Record<string, unknown> | undefined;
            const chat = msg.chat as Record<string, unknown>;
            const normalized: NormalizedMessage = {
              id: String(msg.message_id),
              platform: 'telegram',
              channelId: String(chat.id),
              senderId: String(from?.id || ''),
              senderName: from?.first_name as string || 'Unknown',
              content: msg.text as string,
              attachments: [],
              timestamp: new Date((msg.date as number) * 1000),
              metadata: { chatType: chat.type as string },
            };
            this.handleIncoming(normalized).catch((err: any) => {
              auditLog('TELEGRAM_HANDLE_ERROR', err?.message || String(err));
            });
          }
        }
      }
    } catch (e: any) {
      this.consecutiveErrors++;
      // 1s, 2s, 4s, 8s, ... capped at 60s
      delay = Math.min(60_000, 1000 * Math.pow(2, this.consecutiveErrors - 1));
      auditLog('TELEGRAM_ERROR', `${e.message} (retry in ${delay}ms, error #${this.consecutiveErrors})`);
    }

    this.pollTimer = setTimeout(() => this.pollUpdates(), delay);
  }
}
