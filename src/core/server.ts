/**
 * 🐟 AZERCLAW Server Daemon
 * WebSocket server for desktop apps (Swift, Tauri) to communicate with the core engine.
 */

import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';
import { AgentRuntime } from './runtime';
import { getToolRegistry } from '../tools/registry';

interface ClientMessage {
  type: 'start_chat' | 'chat_message' | 'abort' | 'ping';
  payload?: any;
}

// 30 minutes of inactivity before an agent is considered orphaned
const AGENT_TIMEOUT_MS = 30 * 60 * 1000;

export class AzerclawServer {
  private wss: WebSocketServer;
  private server: http.Server;
  private port: number;
  private agents: Map<string, AgentRuntime> = new Map();
  private agentLastActivity: Map<string, number> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(port: number = 8080) {
    this.port = port;
    this.server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'diabolical', version: '1.0.0' }));
    });

    this.wss = new WebSocketServer({ server: this.server });
    this.setupWebSockets();
  }

  /**
   * Safely send a message to a WebSocket client, checking readyState first.
   */
  private safeSend(ws: WebSocket, data: string): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }

  /**
   * Mark an agent session as recently active.
   */
  private touchAgent(sessionId: string): void {
    this.agentLastActivity.set(sessionId, Date.now());
  }

  /**
   * Sweep and clean up orphaned agent sessions that exceeded the inactivity timeout.
   */
  private cleanupOrphanedAgents(): void {
    const now = Date.now();
    for (const [sessionId, lastActive] of this.agentLastActivity) {
      if (now - lastActive > AGENT_TIMEOUT_MS) {
        const agent = this.agents.get(sessionId);
        if (agent) {
          agent.abort();
          console.log(`🧹 Cleaned up orphaned agent: ${sessionId}`);
        }
        this.agents.delete(sessionId);
        this.agentLastActivity.delete(sessionId);
      }
    }
  }

  private setupWebSockets() {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('🔗 Client connected to Compound V server.');
      
      let sessionId = `sess_${Date.now()}`;
      let agent: AgentRuntime | null = null;

      ws.on('message', async (data: string) => {
        try {
          const msg = JSON.parse(data.toString()) as ClientMessage;

          switch (msg.type) {
            case 'ping':
              this.safeSend(ws, JSON.stringify({ type: 'pong' }));
              break;

            case 'start_chat':
              sessionId = msg.payload?.sessionId || sessionId;
              agent = new AgentRuntime({
                sessionId,
                eventHandler: async (event) => {
                  this.safeSend(ws, JSON.stringify(event));
                }
              });
              this.agents.set(sessionId, agent);
              this.touchAgent(sessionId);
              this.safeSend(ws, JSON.stringify({ type: 'system', payload: 'Agent ready. Scorched earth protocol engaged.' }));
              break;

            case 'chat_message':
              if (!agent) {
                this.safeSend(ws, JSON.stringify({ type: 'error', payload: 'Chat not started. Send start_chat first.' }));
                return;
              }
              this.touchAgent(sessionId);
              try {
                await agent.chat(msg.payload.message);
              } catch (e: any) {
                this.safeSend(ws, JSON.stringify({ type: 'error', payload: e.message }));
              }
              break;

            case 'abort':
              if (agent) {
                agent.abort();
                this.safeSend(ws, JSON.stringify({ type: 'system', payload: 'Operation aborted.' }));
              }
              break;

            default:
              this.safeSend(ws, JSON.stringify({ type: 'error', payload: 'Unknown message type.' }));
          }
        } catch (e: any) {
          this.safeSend(ws, JSON.stringify({ type: 'error', payload: 'Invalid JSON payload.' }));
        }
      });

      ws.on('close', () => {
        console.log('❌ Client disconnected.');
        if (agent) agent.abort();
        this.agents.delete(sessionId);
        this.agentLastActivity.delete(sessionId);
      });
    });
  }

  public start() {
    // Start orphaned agent cleanup sweeper (runs every 5 minutes)
    this.cleanupInterval = setInterval(() => this.cleanupOrphanedAgents(), 5 * 60 * 1000);

    const brand = process.argv[1].includes('opencode') ? 'OPENCODE' : 'AZERCLAW';
    const icon = brand === 'OPENCODE' ? '🔷' : '🔪';
    this.server.listen(this.port, () => {
      console.log(`\n${icon} ${brand} Daemon running on ws://localhost:${this.port}\n`);
    });
  }

  public stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.agents.forEach(agent => agent.abort());
    this.agents.clear();
    this.agentLastActivity.clear();
    this.wss.close();
    this.server.close();
  }
}
