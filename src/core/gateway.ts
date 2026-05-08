/**
 * 🐟 AZERCLAW Gateway Server
 * WebSocket-based control plane that connects CLI, TUI, messenger adapters,
 * heartbeat scheduler, and agent runtime together.
 */

import * as http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { AgentRuntime } from '../core/runtime';
import { HeartbeatEngine } from '../scheduler/heartbeat';
import { DiscordAdapter } from '../channels/discord';
import { TelegramAdapter } from '../channels/telegram';
import { SlackAdapter } from '../channels/slack';
import { WebhookAdapter } from '../channels/webhook';
import { getConfigManager } from '../config/manager';
import { auditLog } from '../core/security';
import { getToolRegistry } from '../tools/registry';
import { shellTool } from '../tools/shell';
import { readFileTool, writeFileTool, listDirTool, searchFilesTool } from '../tools/filesystem';
import { spawnSubAgentTool, webSearchTool, codeAnalysisTool } from '../tools/advanced';

export class Gateway {
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private heartbeat: HeartbeatEngine;
  private channels: Map<string, any> = new Map();
  private clients: Set<WebSocket> = new Set();
  private port: number;

  constructor(port = 3142) {
    this.port = port;
    this.heartbeat = new HeartbeatEngine();
  }

  /**
   * Start the gateway server.
   */
  async start(): Promise<void> {
    const registry = getToolRegistry();
    registry.register(shellTool);
    registry.register(readFileTool);
    registry.register(writeFileTool);
    registry.register(listDirTool);
    registry.register(searchFilesTool);
    registry.register(spawnSubAgentTool);
    registry.register(webSearchTool);
    registry.register(codeAnalysisTool);
    
    this.server = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          version: '1.0.0',
          uptime: process.uptime(),
          channels: Array.from(this.channels.keys()),
          clients: this.clients.size,
        }));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    this.wss = new WebSocketServer({ server: this.server });

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);
      auditLog('GATEWAY_CLIENT', `Connected (${this.clients.size} total)`);

      ws.on('message', async (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          await this.handleClientMessage(ws, msg);
        } catch (e: any) {
          ws.send(JSON.stringify({ type: 'error', error: e.message }));
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });
    });

    // Bind to loopback only
    this.server.listen(this.port, '127.0.0.1', () => {
      auditLog('GATEWAY_STARTED', `ws://127.0.0.1:${this.port}`);
    });

    // Start heartbeat
    this.heartbeat.onEvent((event, details) => {
      this.broadcast({ type: 'heartbeat', event, details });
    });
    this.heartbeat.start();
  }

  /**
   * Stop the gateway.
   */
  async stop(): Promise<void> {
    this.heartbeat.stop();
    for (const [, channel] of this.channels) {
      await channel.disconnect();
    }
    this.wss?.close();
    this.server?.close();
    auditLog('GATEWAY_STOPPED', '');
  }

  /**
   * Handle incoming WebSocket messages.
   */
  private async handleClientMessage(ws: WebSocket, msg: any): Promise<void> {
    switch (msg.type) {
      case 'chat': {
        const agent = new AgentRuntime({
          eventHandler: async (event) => {
            ws.send(JSON.stringify({ agentType: 'agent_event', ...event }));
          },
        });
        await agent.chat(msg.content);
        break;
      }

      case 'heartbeat_status': {
        ws.send(JSON.stringify({
          type: 'heartbeat_status',
          tasks: this.heartbeat.getStatus(),
        }));
        break;
      }

      case 'heartbeat_trigger': {
        const result = await this.heartbeat.triggerTask(msg.taskName);
        ws.send(JSON.stringify({ type: 'heartbeat_result', result }));
        break;
      }

      case 'connect_channel': {
        await this.connectChannel(msg.platform, msg.config);
        ws.send(JSON.stringify({ type: 'channel_connected', platform: msg.platform }));
        break;
      }

      default:
        ws.send(JSON.stringify({ type: 'error', error: `Unknown message type: ${msg.type}` }));
    }
  }

  /**
   * Connect a messenger channel.
   */
  private async connectChannel(platform: string, config: Record<string, string>): Promise<void> {
    let adapter;
    switch (platform) {
      case 'discord': adapter = new DiscordAdapter(); break;
      case 'telegram': adapter = new TelegramAdapter(); break;
      case 'slack': adapter = new SlackAdapter(); break;
      case 'webhook': adapter = new WebhookAdapter(); break;
      default: throw new Error(`Unknown platform: ${platform}`);
    }

    await adapter.connect(config);
    this.channels.set(platform, adapter);
    auditLog('CHANNEL_CONNECTED', platform);
  }

  /**
   * Broadcast a message to all connected clients.
   */
  private broadcast(msg: any): void {
    const data = JSON.stringify(msg);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }
}
