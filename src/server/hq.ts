/**
 * 🏢 VOUGHT HQ Dashboard Server
 * Broadcasts agent events via WebSocket and serves the web dashboard.
 */

import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import { createServer } from 'http';
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
    this.app.get('*', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'dist/dashboard/index.html'));
    });
  }

  start(): void {
    this.server.listen(this.port, () => {
      console.log(`[HQ] Vought HQ active at http://localhost:${this.port}`);
      console.log(`[HQ] WebSocket broadcast on ws://localhost:${this.port}`);
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
