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

export class AzerclawServer {
  private wss: WebSocketServer;
  private server: http.Server;
  private port: number;
  private agents: Map<string, AgentRuntime> = new Map();

  constructor(port: number = 8080) {
    this.port = port;
    this.server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'diabolical', version: '1.0.0' }));
    });

    this.wss = new WebSocketServer({ server: this.server });
    this.setupWebSockets();
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
              ws.send(JSON.stringify({ type: 'pong' }));
              break;

            case 'start_chat':
              sessionId = msg.payload?.sessionId || sessionId;
              agent = new AgentRuntime({
                sessionId,
                eventHandler: async (event) => {
                  ws.send(JSON.stringify(event));
                }
              });
              this.agents.set(sessionId, agent);
              ws.send(JSON.stringify({ type: 'system', payload: 'Agent ready. Scorched earth protocol engaged.' }));
              break;

            case 'chat_message':
              if (!agent) {
                ws.send(JSON.stringify({ type: 'error', payload: 'Chat not started. Send start_chat first.' }));
                return;
              }
              try {
                await agent.chat(msg.payload.message);
              } catch (e: any) {
                ws.send(JSON.stringify({ type: 'error', payload: e.message }));
              }
              break;

            case 'abort':
              if (agent) {
                agent.abort();
                ws.send(JSON.stringify({ type: 'system', payload: 'Operation aborted.' }));
              }
              break;

            default:
              ws.send(JSON.stringify({ type: 'error', payload: 'Unknown message type.' }));
          }
        } catch (e: any) {
          ws.send(JSON.stringify({ type: 'error', payload: 'Invalid JSON payload.' }));
        }
      });

      ws.on('close', () => {
        console.log('❌ Client disconnected.');
        if (agent) agent.abort();
        this.agents.delete(sessionId);
      });
    });
  }

  public start() {
    this.server.listen(this.port, () => {
      console.log(`\n🔪 AZERCLAW Daemon (Diabolical Edition) running on ws://localhost:${this.port}\n`);
    });
  }

  public stop() {
    this.agents.forEach(agent => agent.abort());
    this.wss.close();
    this.server.close();
  }
}
