/**
 * 🐟 AZERCLAW Web Interface
 * Optional lightweight web interface for advanced users
 */

import * as express from 'express';
import * as path from 'path';
import * as http from 'http';
// Note: socket.io is an optional dependency
// import { Server as SocketIOServer } from 'socket.io';
import { EventEmitter } from 'events';
import { getPluginManager } from '../../plugins';
// Note: Memory imports are optional
// import { getSessionStore } from '../../memory';
import { getHeartbeatManager } from '../../workspace';
import { getPrivacyManager } from '../../security/privacy';
import { getNetworkAnalyzer } from '../../networking/analyzer';

// ─── Web Interface Types ───────────────────────────────────────────────

export interface WebServerConfig {
  enabled: boolean;
  port: number;
  host: string;
  auth: {
    enabled: boolean;
    token?: string;
  };
  cors: {
    enabled: boolean;
    origins: string[];
  };
  static: {
    enabled: boolean;
    path: string;
  };
}

export interface WebDashboardData {
  system: {
    uptime: number;
    memory: NodeJS.MemoryUsage;
    cpu: number;
  };
  azerclaw: {
    version: string;
    plugins: number;
    sessions: number;
    tools: number;
  };
  network: {
    packets: number;
    sessions: number;
    activeConnections: number;
  };
  privacy: {
    events: number;
    violations: number;
    lastViolation?: string;
  };
  workspace: {
    tasks: number;
    activeTasks: number;
    completedTasks: number;
  };
}

// ─── Web Server Implementation ─────────────────────────────────────────

export class WebServer extends EventEmitter {
  private app: express.Application;
  private server: http.Server | null = null;
  // private io: SocketIOServer | null = null; // Optional dependency
  private config: WebServerConfig;
  private isRunning: boolean = false;

  constructor(config: Partial<WebServerConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      port: 3000,
      host: 'localhost',
      auth: {
        enabled: false
      },
      cors: {
        enabled: true,
        origins: ['http://localhost:3000']
      },
      static: {
        enabled: true,
        path: path.join(__dirname, 'public')
      },
      ...config
    };

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // CORS
    if (this.config.cors.enabled) {
      // Note: cors is an optional dependency
      try {
        const cors = require('cors');
        this.app.use(cors({
          origin: this.config.cors.origins,
          credentials: true
        }));
      } catch (error) {
        console.warn('[WebServer] CORS middleware not available, skipping...');
      }
    }

    // JSON parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Authentication middleware
    if (this.config.auth.enabled) {
      this.app.use(this.authMiddleware.bind(this));
    }

    // Static files
    if (this.config.static.enabled) {
      this.app.use(express.static(this.config.static.path));
    }

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`[WebServer] ${req.method} ${req.path}`);
      next();
    });
  }

  private authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): void {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || authHeader !== `Bearer ${this.config.auth.token}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    next();
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '2.2.0'
      });
    });

    // Dashboard data
    this.app.get('/api/dashboard', async (req, res) => {
      try {
        const data = await this.getDashboardData();
        res.json(data);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get dashboard data' });
      }
    });

    // Plugin management
    this.app.get('/api/plugins', async (req, res) => {
      try {
        const pluginManager = getPluginManager();
        const plugins = await pluginManager.listPlugins();
        res.json(plugins.map(p => ({
          id: p.id,
          name: p.plugin.metadata.name,
          version: p.plugin.metadata.version,
          description: p.plugin.metadata.description,
          status: p.status,
          enabled: p.status === 'active'
        })));
      } catch (error) {
        res.status(500).json({ error: 'Failed to get plugins' });
      }
    });

    this.app.post('/api/plugins/:id/toggle', async (req, res) => {
      try {
        const pluginManager = getPluginManager();
        const pluginId = req.params.id;
        const plugin = await pluginManager.getPlugin(pluginId);
        
        if (!plugin) {
          return res.status(404).json({ error: 'Plugin not found' });
        }

        if (plugin.status === 'active') {
          await pluginManager.deactivatePlugin(pluginId);
        } else {
          await pluginManager.activatePlugin(pluginId);
        }

        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: 'Failed to toggle plugin' });
      }
    });

    // Memory management
    this.app.get('/api/memory/stats', async (req, res) => {
      try {
        const sessionStore = getSessionStore();
        const stats = sessionStore.getGlobalUsage();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get memory stats' });
      }
    });

    this.app.get('/api/memory/sessions', async (req, res) => {
      try {
        const sessionStore = getSessionStore();
        const sessions = sessionStore.list(20);
        res.json(sessions);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get sessions' });
      }
    });

    // Workspace tasks
    this.app.get('/api/workspace/tasks', async (req, res) => {
      try {
        const heartbeatManager = getHeartbeatManager();
        const tasks = heartbeatManager.getTasks();
        const executions = heartbeatManager.getExecutions();
        
        res.json({
          tasks,
          executions: executions.slice(0, 10), // Last 10 executions
          stats: heartbeatManager.getStats()
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get workspace tasks' });
      }
    });

    this.app.post('/api/workspace/tasks/:id/execute', async (req, res) => {
      try {
        const heartbeatManager = getHeartbeatManager();
        const execution = await heartbeatManager.executeTask(req.params.id);
        res.json(execution);
      } catch (error) {
        res.status(500).json({ error: 'Failed to execute task' });
      }
    });

    // Privacy monitoring
    this.app.get('/api/privacy/events', async (req, res) => {
      try {
        const privacyManager = getPrivacyManager();
        const events = privacyManager.getEvents();
        res.json(events.slice(0, 100)); // Last 100 events
      } catch (error) {
        res.status(500).json({ error: 'Failed to get privacy events' });
      }
    });

    this.app.get('/api/privacy/violations', async (req, res) => {
      try {
        const privacyManager = getPrivacyManager();
        const violations = privacyManager.getViolations();
        res.json(violations);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get privacy violations' });
      }
    });

    // Network analysis
    this.app.get('/api/network/stats', async (req, res) => {
      try {
        const networkAnalyzer = getNetworkAnalyzer();
        const stats = networkAnalyzer.getStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get network stats' });
      }
    });

    this.app.get('/api/network/sessions', async (req, res) => {
      try {
        const networkAnalyzer = getNetworkAnalyzer();
        const sessions = networkAnalyzer.getSessions();
        res.json(sessions.slice(0, 50)); // Last 50 sessions
      } catch (error) {
        res.status(500).json({ error: 'Failed to get network sessions' });
      }
    });

    this.app.post('/api/network/capture/start', async (req, res) => {
      try {
        const networkAnalyzer = getNetworkAnalyzer();
        await networkAnalyzer.startCapture();
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: 'Failed to start packet capture' });
      }
    });

    this.app.post('/api/network/capture/stop', async (req, res) => {
      try {
        const networkAnalyzer = getNetworkAnalyzer();
        networkAnalyzer.stopCapture();
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: 'Failed to stop packet capture' });
      }
    });

    // Configuration
    this.app.get('/api/config', (req, res) => {
      // Return non-sensitive configuration
      res.json({
        version: '2.2.0',
        features: {
          plugins: true,
          vectorMemory: true,
          dreaming: true,
          workspace: true,
          privacy: true,
          networkAnalysis: true,
          terminalDashboard: true
        }
      });
    });

    // Serve main HTML file for SPA
    this.app.get('*', (req, res) => {
      if (this.config.static.enabled) {
        res.sendFile(path.join(this.config.static.path, 'index.html'));
      } else {
        res.status(404).json({ error: 'Not found' });
      }
    });
  }

  private async getDashboardData(): Promise<WebDashboardData> {
    const system = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: Math.random() * 100 // Mock CPU usage
    };

    let azerclaw = {
      version: '2.2.0',
      plugins: 0,
      sessions: 0,
      tools: 0
    };

    try {
      const pluginManager = getPluginManager();
      const plugins = await pluginManager.listPlugins();
      const sessionStore = getSessionStore();
      
      azerclaw = {
        version: '2.2.0',
        plugins: plugins.length,
        sessions: sessionStore.list(1000).length,
        tools: plugins.reduce((sum, p) => sum + (p.plugin.tools?.length || 0), 0)
      };
    } catch (error) {
      console.warn('Failed to get AZERCLAW stats:', error);
    }

    let network = {
      packets: 0,
      sessions: 0,
      activeConnections: 0
    };

    try {
      const networkAnalyzer = getNetworkAnalyzer();
      const stats = networkAnalyzer.getStats();
      network = {
        packets: stats.totalPackets,
        sessions: stats.totalSessions,
        activeConnections: stats.activeSessions
      };
    } catch (error) {
      console.warn('Failed to get network stats:', error);
    }

    let privacy = {
      events: 0,
      violations: 0
    };

    try {
      const privacyManager = getPrivacyManager();
      const stats = privacyManager.getStats();
      const violations = privacyManager.getViolations();
      privacy = {
        events: stats.totalEvents,
        violations: stats.totalViolations
      };
    } catch (error) {
      console.warn('Failed to get privacy stats:', error);
    }

    let workspace = {
      tasks: 0,
      activeTasks: 0,
      completedTasks: 0
    };

    try {
      const heartbeatManager = getHeartbeatManager();
      const stats = heartbeatManager.getStats();
      workspace = {
        tasks: stats.totalTasks,
        activeTasks: stats.runningExecutions,
        completedTasks: stats.completedExecutions
      };
    } catch (error) {
      console.warn('Failed to get workspace stats:', error);
    }

    return {
      system,
      azerclaw,
      network,
      privacy,
      workspace
    };
  }

  private setupSocketIO(): void {
    // SocketIO is optional - comment out for now
    console.log('[WebServer] SocketIO setup skipped - optional dependency');
    this.emit('socketio-setup');
  }

  // ─── Server Lifecycle ───────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.isRunning || !this.config.enabled) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.config.port, this.config.host, () => {
        this.isRunning = true;
        console.log(`[WebServer] Started on http://${this.config.host}:${this.config.port}`);
        this.setupSocketIO();
        this.emit('server-started');
        resolve();
      });

      this.server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          reject(new Error(`Port ${this.config.port} is already in use`));
        } else {
          reject(error);
        }
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.isRunning = false;
          console.log('[WebServer] Stopped');
          this.emit('server-stopped');
          resolve();
        });
      } else {
        resolve();
      }

      if (this.io) {
        this.io.close();
        this.io = null;
      }
    });
  }

  // ─── Public API ─────────────────────────────────────────────────────

  getConfig(): WebServerConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<WebServerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.isRunning && (newConfig.port || newConfig.host)) {
      // Restart server with new config
      this.stop().then(() => this.start());
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getAddress(): string | null {
    if (this.server && this.isRunning) {
      const address = this.server.address();
      if (typeof address === 'string') {
        return address;
      } else if (address) {
        return `http://${address.address}:${address.port}`;
      }
    }
    return null;
  }
}

// ─── Global Web Server ─────────────────────────────────────────────────

let webServer: WebServer | null = null;

export function getWebServer(config?: Partial<WebServerConfig>): WebServer {
  if (!webServer) {
    webServer = new WebServer(config);
  }
  return webServer;
}

export async function initializeWebServer(config?: Partial<WebServerConfig>): Promise<WebServer> {
  if (webServer) {
    await webServer.stop();
  }
  webServer = new WebServer(config);
  await webServer.start();
  return webServer;
}

export async function shutdownWebServer(): Promise<void> {
  if (webServer) {
    await webServer.stop();
    webServer = null;
  }
}
