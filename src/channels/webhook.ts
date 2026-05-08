/**
 * 🐟 AZERCLAW Generic Webhook Channel
 * Receives messages via HTTP POST and sends responses back.
 * Works with any platform that supports webhooks.
 */

import * as http from 'http';
import { ChannelAdapter, NormalizedMessage, SendOptions } from './adapter';
import { auditLog } from '../core/security';

export class WebhookAdapter extends ChannelAdapter {
  readonly platform = 'webhook';
  readonly displayName = 'Webhook';
  private server: http.Server | null = null;
  private responseUrl = '';
  private port = 3141;
  private connected = false;

  async connect(config: Record<string, string>): Promise<void> {
    this.port = parseInt(config.port || '3141');
    this.responseUrl = config.responseUrl || '';

    this.server = http.createServer(async (req, res) => {
      if (req.method !== 'POST') {
        res.writeHead(405);
        res.end('Method not allowed');
        return;
      }

      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const message: NormalizedMessage = {
            id: data.id || `wh_${Date.now()}`,
            platform: 'webhook',
            channelId: data.channelId || 'default',
            senderId: data.senderId || 'webhook',
            senderName: data.senderName || 'Webhook',
            content: data.content || data.message || data.text || '',
            attachments: [],
            timestamp: new Date(),
            metadata: data.metadata || {},
          };

          await this.handleIncoming(message);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e: any) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    });

    // Bind to localhost only for security
    this.server.listen(this.port, '127.0.0.1', () => {
      this.connected = true;
      auditLog('WEBHOOK_STARTED', `Listening on 127.0.0.1:${this.port}`);
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.connected = false;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  async send(options: SendOptions): Promise<void> {
    if (this.responseUrl) {
      await fetch(this.responseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: options.channelId,
          content: options.content,
          replyTo: options.replyTo,
        }),
      });
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
