/**
 * 🏢 VOUGHT HQ Dashboard Server
 * Broadcasts agent events via WebSocket and serves the web dashboard.
 */

import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import { createServer } from 'http';
import * as fs from 'fs';
import path from 'path';
import { AgentEvent } from '../core/runtime';

export class VoughtHQ {
  private app = express();
  private server = createServer(this.app);
  private wss = new WebSocketServer({ server: this.server });
  private port: number = 8443;
  private clients: Set<WebSocket> = new Set();

  constructor(port: number = 8443) {
    this.port = port;
    
    // Serve static dashboard files (to be built)
    this.app.use(express.static(path.join(process.cwd(), 'dist/dashboard')));
    
    // Fallback for SPA
    this.app.use((req, res) => {
      const indexPath = path.join(process.cwd(), 'dist/dashboard/index.html');
      if (!fs.existsSync(indexPath)) {
        res.status(404).send('Dashboard not built. Run `npm run build`.');
        return;
      }
      res.sendFile(indexPath);
    });
  }

  start(): void {
    // Bind to loopback by default; allow opt-in remote exposure via env var.
    const host = process.env.AZERCLAW_HQ_HOST || '127.0.0.1';
    this.server.listen(this.port, host, () => {
      console.log(`[HQ] Vought HQ active at http://${host}:${this.port}`);
      console.log(`[HQ] WebSocket broadcast on ws://${host}:${this.port}`);
    });

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      ws.send(JSON.stringify({ type: 'sys', content: 'Connected to Vought HQ' }));

      ws.on('close', () => {
        this.clients.delete(ws);
      });
    });
  }

  /**
   * Broadcast an agent event to all connected dashboard clients.
   */
  broadcast(event: AgentEvent): void {
    const data = JSON.stringify({
      ...event,
      timestamp: new Date().toISOString(),
    });
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  stop(): void {
    this.wss.close();
    this.server.close();
  }
}

let instance: VoughtHQ | null = null;
export function getVoughtHQ(): VoughtHQ {
  if (!instance) instance = new VoughtHQ();
  return instance;
}
