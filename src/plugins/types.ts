/**
 * 🐟 AZERCLAW Plugin System Types
 * Extends the existing tool system to support OpenClaw-style plugins
 */

import { Tool, ToolResult } from '../tools/registry';
export { Tool, ToolResult };

// ─── Plugin Types ──────────────────────────────────────────────────────

export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  repository?: string;
  homepage?: string;
  keywords?: string[];
  
  // Dependencies
  depends?: string[];
  peerDepends?: string[];
  optionalDepends?: string[];
  
  // Capabilities
  capabilities: PluginCapability[];
  requires: PluginRequirement[];
  
  // Compatibility
  azerclawVersion: string;
  nodeVersion?: string;
  platforms?: string[];
  
  // Security
  permissions: PluginPermission[];
  sandbox?: PluginSandboxConfig;
}

export interface PluginCapability {
  type: 'tool' | 'provider' | 'memory' | 'workflow' | 'channel' | 'ui' | 'system';
  name: string;
  description: string;
  api?: string; // API version/level
}

export interface PluginRequirement {
  type: 'api' | 'tool' | 'service' | 'hardware' | 'os';
  name: string;
  version?: string;
  optional?: boolean;
}

export interface PluginPermission {
  type: 'filesystem' | 'network' | 'system' | 'process' | 'memory' | 'config';
  scope: string;
  description: string;
}

export interface PluginSandboxConfig {
  enabled: boolean;
  allowedTools?: string[];
  deniedTools?: string[];
  filesystem?: {
    read?: string[];
    write?: string[];
    exec?: string[];
  };
  network?: {
    domains?: string[];
    ports?: number[];
  };
}

// ─── Plugin Interface ───────────────────────────────────────────────────

export interface Plugin {
  readonly metadata: PluginMetadata;
  readonly tools: Tool[];
  readonly providers?: any[]; // Provider implementations
  readonly workflows?: any[]; // Workflow definitions
  
  // Lifecycle hooks
  initialize?(context: PluginContext): Promise<void>;
  activate?(context: PluginContext): Promise<void>;
  deactivate?(context: PluginContext): Promise<void>;
  cleanup?(context: PluginContext): Promise<void>;
  
  // Configuration
  configure?(config: Record<string, unknown>): Promise<void>;
  getConfig?(): Record<string, unknown>;
  
  // Health checks
  healthCheck?(): Promise<PluginHealth>;
}

export interface PluginContext {
  pluginId: string;
  workspaceDir?: string;
  azerclawHome: string;
  configDir: string;
  dataDir: string;
  tempDir: string;
  
  // APIs
  logger: PluginLogger;
  events: PluginEventEmitter;
  storage: PluginStorage;
  
  // Services
  toolRegistry: any; // ToolRegistry instance
  configManager: any; // ConfigManager instance
  memoryStore: any; // Memory store instance
}

export interface PluginLogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export interface PluginEventEmitter {
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
}

export interface PluginStorage {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  list(): Promise<string[]>;
}

export interface PluginHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  details?: Record<string, any>;
  lastCheck: Date;
}

// ─── Plugin Manager Types ───────────────────────────────────────────────

export interface PluginManager {
  // Plugin lifecycle
  loadPlugin(pluginPath: string): Promise<LoadedPlugin>;
  unloadPlugin(pluginId: string): Promise<void>;
  activatePlugin(pluginId: string): Promise<void>;
  deactivatePlugin(pluginId: string): Promise<void>;
  
  // Plugin discovery
  discoverPlugins(): Promise<string[]>;
  reloadPlugins(): Promise<void>;
  
  // Plugin information
  listPlugins(): Promise<LoadedPlugin[]>;
  getPlugin(pluginId: string): Promise<LoadedPlugin | null>;
  getPluginHealth(pluginId: string): Promise<PluginHealth | null>;
  
  // Plugin operations
  installPlugin(source: string): Promise<string>;
  uninstallPlugin(pluginId: string): Promise<void>;
  updatePlugin(pluginId: string): Promise<void>;
}

export interface LoadedPlugin {
  id: string;
  plugin: Plugin;
  path: string;
  status: 'loaded' | 'active' | 'inactive' | 'error';
  loadedAt: Date;
  activatedAt?: Date;
  error?: Error;
  health?: PluginHealth;
}

// ─── Plugin Registry Types ──────────────────────────────────────────────

export interface PluginRegistry {
  // Tool registration
  registerTool(pluginId: string, tool: Tool): void;
  unregisterTool(pluginId: string, toolName: string): void;
  getToolsByPlugin(pluginId: string): Tool[];
  
  // Provider registration
  registerProvider(pluginId: string, provider: any): void;
  unregisterProvider(pluginId: string, providerName: string): void;
  
  // Workflow registration
  registerWorkflow(pluginId: string, workflow: any): void;
  unregisterWorkflow(pluginId: string, workflowName: string): void;
  
  // Capability queries
  getPluginsByCapability(capability: string): LoadedPlugin[];
  hasCapability(pluginId: string, capability: string): boolean;
}

// ─── Plugin Configuration Types ─────────────────────────────────────────

export interface PluginConfig {
  enabled: boolean;
  autoStart: boolean;
  config: Record<string, unknown>;
  permissions: PluginPermission[];
  sandbox?: PluginSandboxConfig;
}

export interface PluginGlobalConfig {
  pluginDir: string;
  autoLoad: boolean;
  sandboxDefault: boolean;
  permissions: {
    default: PluginPermission[];
    restricted: PluginPermission[];
  };
  security: {
    verifySignature: boolean;
    allowUnsigned: boolean;
    trustedSources: string[];
  };
}
