/**
 * 🐟 AZERCLAW Plugin Manager
 * Manages plugin lifecycle, discovery, and security
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { 
  Plugin, 
  PluginManager as IPluginManager, 
  LoadedPlugin, 
  PluginContext,
  PluginHealth,
  PluginConfig,
  PluginGlobalConfig
} from './types';

// ─── Plugin Manager Implementation ──────────────────────────────────────

export class PluginManager extends EventEmitter implements IPluginManager {
  private plugins = new Map<string, LoadedPlugin>();
  private pluginConfigs = new Map<string, PluginConfig>();
  private globalConfig: PluginGlobalConfig;
  private azerclawHome: string;
  private pluginDir: string;

  constructor() {
    super();
    this.azerclawHome = path.join(os.homedir(), '.azerclaw');
    this.pluginDir = path.join(this.azerclawHome, 'plugins');
    this.globalConfig = this.loadGlobalConfig();
    this.ensureDirectories();
  }

  // ─── Plugin Lifecycle ────────────────────────────────────────────────

  async loadPlugin(pluginPath: string): Promise<LoadedPlugin> {
    const pluginId = path.basename(pluginPath);
    
    // Check if already loaded
    if (this.plugins.has(pluginId)) {
      throw new Error(`Plugin ${pluginId} is already loaded`);
    }

    try {
      // Load plugin module
      const pluginModule = require(pluginPath);
      const plugin: Plugin = pluginModule.default || pluginModule;

      // Validate plugin
      this.validatePlugin(plugin);

      // Create plugin context
      const context = this.createPluginContext(pluginId);

      // Initialize plugin
      if (plugin.initialize) {
        await plugin.initialize(context);
      }

      // Register plugin tools
      if (plugin.tools) {
        for (const tool of plugin.tools) {
          // Will be handled by extended ToolRegistry
          this.emit('tool-register', { pluginId, tool });
        }
      }

      const loadedPlugin: LoadedPlugin = {
        id: pluginId,
        plugin,
        path: pluginPath,
        status: 'loaded',
        loadedAt: new Date()
      };

      this.plugins.set(pluginId, loadedPlugin);
      this.emit('plugin-loaded', loadedPlugin);

      return loadedPlugin;
    } catch (error) {
      const loadedPlugin: LoadedPlugin = {
        id: pluginId,
        plugin: null as any,
        path: pluginPath,
        status: 'error',
        loadedAt: new Date(),
        error: error as Error
      };

      this.plugins.set(pluginId, loadedPlugin);
      this.emit('plugin-error', loadedPlugin);
      throw error;
    }
  }

  async unloadPlugin(pluginId: string): Promise<void> {
    const loadedPlugin = this.plugins.get(pluginId);
    if (!loadedPlugin) {
      throw new Error(`Plugin ${pluginId} is not loaded`);
    }

    try {
      // Deactivate if active
      if (loadedPlugin.status === 'active') {
        await this.deactivatePlugin(pluginId);
      }

      // Cleanup plugin
      if (loadedPlugin.plugin.cleanup) {
        const context = this.createPluginContext(pluginId);
        await loadedPlugin.plugin.cleanup(context);
      }

      // Unregister tools
      if (loadedPlugin.plugin.tools) {
        for (const tool of loadedPlugin.plugin.tools) {
          this.emit('tool-unregister', { pluginId, toolName: tool.name });
        }
      }

      // Remove from cache
      delete require.cache[require.resolve(loadedPlugin.path)];
      
      this.plugins.delete(pluginId);
      this.emit('plugin-unloaded', { pluginId });
    } catch (error) {
      this.emit('plugin-error', { pluginId, error });
      throw error;
    }
  }

  async activatePlugin(pluginId: string): Promise<void> {
    const loadedPlugin = this.plugins.get(pluginId);
    if (!loadedPlugin) {
      throw new Error(`Plugin ${pluginId} is not loaded`);
    }

    if (loadedPlugin.status === 'active') {
      return; // Already active
    }

    try {
      const context = this.createPluginContext(pluginId);

      // Activate plugin
      if (loadedPlugin.plugin.activate) {
        await loadedPlugin.plugin.activate(context);
      }

      loadedPlugin.status = 'active';
      loadedPlugin.activatedAt = new Date();
      
      this.emit('plugin-activated', loadedPlugin);
    } catch (error) {
      loadedPlugin.status = 'error';
      loadedPlugin.error = error as Error;
      this.emit('plugin-error', loadedPlugin);
      throw error;
    }
  }

  async deactivatePlugin(pluginId: string): Promise<void> {
    const loadedPlugin = this.plugins.get(pluginId);
    if (!loadedPlugin) {
      throw new Error(`Plugin ${pluginId} is not loaded`);
    }

    if (loadedPlugin.status !== 'active') {
      return; // Not active
    }

    try {
      const context = this.createPluginContext(pluginId);

      // Deactivate plugin
      if (loadedPlugin.plugin.deactivate) {
        await loadedPlugin.plugin.deactivate(context);
      }

      loadedPlugin.status = 'inactive';
      delete loadedPlugin.activatedAt;
      
      this.emit('plugin-deactivated', loadedPlugin);
    } catch (error) {
      loadedPlugin.status = 'error';
      loadedPlugin.error = error as Error;
      this.emit('plugin-error', loadedPlugin);
      throw error;
    }
  }

  // ─── Plugin Discovery ───────────────────────────────────────────────

  async discoverPlugins(): Promise<string[]> {
    const pluginPaths: string[] = [];

    // Discover from plugin directory
    if (fs.existsSync(this.pluginDir)) {
      const entries = fs.readdirSync(this.pluginDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginPath = path.join(this.pluginDir, entry.name);
          const packageJsonPath = path.join(pluginPath, 'package.json');
          const indexPath = path.join(pluginPath, 'index.js');
          const tsIndexPath = path.join(pluginPath, 'index.ts');

          // Check if it's a valid plugin
          if (fs.existsSync(packageJsonPath) && 
              (fs.existsSync(indexPath) || fs.existsSync(tsIndexPath))) {
            pluginPaths.push(fs.existsSync(indexPath) ? indexPath : tsIndexPath);
          }
        } else if (entry.name.endsWith('.js') || entry.name.endsWith('.ts')) {
          pluginPaths.push(path.join(this.pluginDir, entry.name));
        }
      }
    }

    // Discover from workspace
    const workspaceDir = process.cwd();
    const workspacePluginDir = path.join(workspaceDir, '.azerclaw', 'plugins');
    
    if (fs.existsSync(workspacePluginDir)) {
      const entries = fs.readdirSync(workspacePluginDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.name.endsWith('.js') || entry.name.endsWith('.ts')) {
          pluginPaths.push(path.join(workspacePluginDir, entry.name));
        }
      }
    }

    return pluginPaths;
  }

  async reloadPlugins(): Promise<void> {
    // Unload all plugins
    const pluginIds = Array.from(this.plugins.keys());
    for (const pluginId of pluginIds) {
      try {
        await this.unloadPlugin(pluginId);
      } catch (error) {
        console.error(`Error unloading plugin ${pluginId}:`, error);
      }
    }

    // Discover and load plugins
    if (this.globalConfig.autoLoad) {
      const pluginPaths = await this.discoverPlugins();
      
      for (const pluginPath of pluginPaths) {
        try {
          await this.loadPlugin(pluginPath);
        } catch (error) {
          console.error(`Error loading plugin ${pluginPath}:`, error);
        }
      }
    }
  }

  // ─── Plugin Information ───────────────────────────────────────────────

  async listPlugins(): Promise<LoadedPlugin[]> {
    return Array.from(this.plugins.values());
  }

  async getPlugin(pluginId: string): Promise<LoadedPlugin | null> {
    return this.plugins.get(pluginId) || null;
  }

  getPluginCount(): number {
    return this.plugins.size;
  }

  async getPluginHealth(pluginId: string): Promise<PluginHealth | null> {
    const loadedPlugin = this.plugins.get(pluginId);
    if (!loadedPlugin) {
      return null;
    }

    if (loadedPlugin.plugin.healthCheck) {
      try {
        const health = await loadedPlugin.plugin.healthCheck();
        loadedPlugin.health = health;
        return health;
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `Health check failed: ${(error as Error).message}`,
          lastCheck: new Date()
        };
      }
    }

    // Default health based on status
    return {
      status: loadedPlugin.status === 'active' ? 'healthy' : 'degraded',
      message: `Plugin status: ${loadedPlugin.status}`,
      lastCheck: new Date()
    };
  }

  // ─── Plugin Operations ───────────────────────────────────────────────

  async installPlugin(source: string): Promise<string> {
    // This would implement plugin installation from npm, git, or local file
    // For now, return a placeholder
    throw new Error('Plugin installation not yet implemented');
  }

  async uninstallPlugin(pluginId: string): Promise<void> {
    await this.unloadPlugin(pluginId);
    // Remove plugin files
    throw new Error('Plugin uninstallation not yet implemented');
  }

  async updatePlugin(pluginId: string): Promise<void> {
    throw new Error('Plugin updates not yet implemented');
  }

  // ─── Private Methods ─────────────────────────────────────────────────

  private validatePlugin(plugin: Plugin): void {
    if (!plugin.metadata) {
      throw new Error('Plugin must have metadata');
    }

    const { metadata } = plugin;
    if (!metadata.name || !metadata.version || !metadata.capabilities) {
      throw new Error('Plugin metadata must include name, version, and capabilities');
    }

    // Validate capabilities
    for (const capability of metadata.capabilities) {
      if (!capability.type || !capability.name) {
        throw new Error('Each capability must have type and name');
      }
    }
  }

  private createPluginContext(pluginId: string): PluginContext {
    return {
      pluginId,
      azerclawHome: this.azerclawHome,
      configDir: path.join(this.azerclawHome, 'config'),
      dataDir: path.join(this.azerclawHome, 'data'),
      tempDir: path.join(this.azerclawHome, 'tmp'),
      workspaceDir: process.cwd(),
      
      logger: {
        debug: (msg, ...args) => console.debug(`[Plugin:${pluginId}] ${msg}`, ...args),
        info: (msg, ...args) => console.info(`[Plugin:${pluginId}] ${msg}`, ...args),
        warn: (msg, ...args) => console.warn(`[Plugin:${pluginId}] ${msg}`, ...args),
        error: (msg, ...args) => console.error(`[Plugin:${pluginId}] ${msg}`, ...args),
      },
      
      events: new EventEmitter(),
      
      storage: {
        get: async (key: string) => {
          // Implement plugin storage
          return null;
        },
        set: async (key: string, value: any) => {
          // Implement plugin storage
        },
        delete: async (key: string) => {
          // Implement plugin storage
        },
        clear: async () => {
          // Implement plugin storage
        },
        list: async () => {
          // Implement plugin storage
          return [];
        }
      },
      
      // Services will be injected by the main application
      toolRegistry: null as any,
      configManager: null as any,
      memoryStore: null as any
    };
  }

  private loadGlobalConfig(): PluginGlobalConfig {
    const configPath = path.join(this.azerclawHome, 'plugins.json');
    
    if (fs.existsSync(configPath)) {
      try {
        return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      } catch (error) {
        console.warn('Invalid plugin config, using defaults');
      }
    }

    return {
      pluginDir: this.pluginDir,
      autoLoad: true,
      sandboxDefault: true,
      permissions: {
        default: [],
        restricted: []
      },
      security: {
        verifySignature: false,
        allowUnsigned: true,
        trustedSources: []
      }
    };
  }

  private ensureDirectories(): void {
    const dirs = [
      this.azerclawHome,
      this.pluginDir,
      path.join(this.azerclawHome, 'config'),
      path.join(this.azerclawHome, 'data'),
      path.join(this.azerclawHome, 'tmp')
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }
    }
  }
}
