/**
 * 🐟 AZERCLAW Configuration Hot-Reload
 * Real-time configuration updates with validation and rollback
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { ConfigManager } from './manager';
import { ConfigSchema, AzerclawConfig, ProjectSettingsSchema, ProjectSettings } from './schema';

// ─── Hot-Reload Types ───────────────────────────────────────────────────

export interface HotReloadConfig {
  enabled: boolean;
  debounceMs: number;
  validationEnabled: boolean;
  rollbackOnError: boolean;
  maxRetries: number;
  watchedFiles: string[];
}

export interface ConfigChange {
  type: 'global' | 'project' | 'local-project' | 'runtime';
  path: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
  validated: boolean;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  criticalErrors: string[];
}

export interface ConfigSnapshot {
  id: string;
  timestamp: Date;
  config: AzerclawConfig;
  projectSettings?: ProjectSettings;
  localProjectSettings?: ProjectSettings;
  changes: ConfigChange[];
}

// ─── Hot-Reload Manager Implementation ─────────────────────────────────

export class HotReloadManager extends EventEmitter {
  private config: HotReloadConfig;
  private configManager: ConfigManager;
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private snapshots: ConfigSnapshot[] = [];
  private maxSnapshots: number = 10;
  private isReloading: boolean = false;
  private reloadQueue: Set<string> = new Set();

  constructor(configManager: ConfigManager, config: Partial<HotReloadConfig> = {}) {
    super();
    
    this.configManager = configManager;
    this.config = {
      enabled: true,
      debounceMs: 500,
      validationEnabled: true,
      rollbackOnError: true,
      maxRetries: 3,
      watchedFiles: [],
      ...config
    };
    
    this.setupWatchers();
  }

  // ─── File Watching ─────────────────────────────────────────────────

  private setupWatchers(): void {
    if (!this.config.enabled) {
      return;
    }

    // Watch global config file
    const globalConfigPath = this.getGlobalConfigPath();
    this.watchFile('global', globalConfigPath);

    // Watch project config files
    const projectConfigPath = this.getProjectConfigPath();
    if (projectConfigPath) {
      this.watchFile('project', projectConfigPath);
    }

    // Watch local project config files
    const localProjectConfigPath = this.getLocalProjectConfigPath();
    if (localProjectConfigPath) {
      this.watchFile('local-project', localProjectConfigPath);
    }
  }

  private watchFile(type: string, filePath: string): void {
    if (!fs.existsSync(filePath)) {
      return;
    }

    // Close existing watcher for this type to prevent leaks
    const existing = this.watchers.get(type);
    if (existing) {
      try { existing.close(); } catch { /* ignore */ }
      this.watchers.delete(type);
    }

    try {
      const watcher = fs.watch(filePath, (eventType) => {
        if (eventType === 'change') {
          this.handleFileChange(type, filePath);
        }
      });

      this.watchers.set(type, watcher);
      if (!this.config.watchedFiles.includes(filePath)) {
        this.config.watchedFiles.push(filePath);
      }
      
      console.log(`[HotReload] Watching ${type} config: ${filePath}`);
    } catch (error) {
      console.error(`[HotReload] Failed to watch ${type} config:`, error);
    }
  }

  private handleFileChange(type: string, filePath: string): void {
    if (!this.config.enabled) {
      return;
    }

    console.log(`[HotReload] ${type} config file changed: ${path.basename(filePath)}`);

    // Debounce rapid changes
    if (this.debounceTimers.has(type)) {
      clearTimeout(this.debounceTimers.get(type)!);
    }

    const timer = setTimeout(() => {
      this.processConfigChange(type, filePath);
      this.debounceTimers.delete(type);
    }, this.config.debounceMs);

    this.debounceTimers.set(type, timer);
  }

  private async processConfigChange(type: string, filePath: string): Promise<void> {
    if (this.isReloading) {
      this.reloadQueue.add(type);
      return;
    }

    this.isReloading = true;

    try {
      // Create snapshot before change
      const snapshot = this.createSnapshot(type);
      
      // Validate new configuration
      const validationResult = await this.validateConfig(type, filePath);
      
      if (!validationResult.valid && this.config.validationEnabled) {
        console.error(`[HotReload] Invalid ${type} configuration:`, validationResult.errors);
        
        if (this.config.rollbackOnError) {
          console.log(`[HotReload] Rolling back ${type} configuration...`);
          await this.rollbackToSnapshot(snapshot);
          this.emit('rollback', { type, snapshot, errors: validationResult.errors });
        }
        
        this.emit('validation-failed', { type, validationResult });
        return;
      }

      // Apply the configuration change
      await this.applyConfigChange(type, filePath, snapshot);
      
      console.log(`[HotReload] Successfully reloaded ${type} configuration`);
      this.emit('config-reloaded', { type, snapshot, validationResult });
      
    } catch (error) {
      console.error(`[HotReload] Failed to process ${type} config change:`, error);
      this.emit('reload-failed', { type, error });
    } finally {
      this.isReloading = false;
      
      // Process queued changes
      if (this.reloadQueue.size > 0) {
        const nextType = this.reloadQueue.values().next().value;
        if (nextType) {
          this.reloadQueue.delete(nextType);
          setImmediate(() => this.processConfigChange(nextType, filePath || ''));
        }
      }
    }
  }

  // ─── Configuration Validation ───────────────────────────────────────

  private async validateConfig(type: string, filePath: string): Promise<ConfigValidationResult> {
    const result: ConfigValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      criticalErrors: []
    };

    try {
      if (!fs.existsSync(filePath)) {
        result.valid = false;
        result.criticalErrors.push(`Configuration file not found: ${filePath}`);
        return result;
      }

      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);

      // Validate based on configuration type
      switch (type) {
        case 'global':
          this.validateGlobalConfig(parsed, result);
          break;
        case 'project':
        case 'local-project':
          this.validateProjectConfig(parsed, result);
          break;
        default:
          result.warnings.push(`Unknown configuration type: ${type}`);
      }

      // Check for required fields
      this.validateRequiredFields(parsed, result);

    } catch (error) {
      result.valid = false;
      result.criticalErrors.push(`JSON parsing failed: ${(error as Error).message}`);
    }

    return result;
  }

  private validateGlobalConfig(config: any, result: ConfigValidationResult): void {
    try {
      ConfigSchema.parse(config);
    } catch (error) {
      result.valid = false;
      result.errors.push(`Global config validation failed: ${(error as Error).message}`);
    }

    // Additional custom validations
    if (config.ai?.providers) {
      for (const [providerName, providerConfig] of Object.entries(config.ai.providers)) {
        if (typeof providerConfig === 'object' && providerConfig !== null) {
          const provider = providerConfig as any;
          if (provider.enabled && !provider.apiKey) {
            result.warnings.push(`Provider ${providerName} is enabled but has no API key`);
          }
        }
      }
    }
  }

  private validateProjectConfig(config: any, result: ConfigValidationResult): void {
    try {
      ProjectSettingsSchema.parse(config);
    } catch (error) {
      result.valid = false;
      result.errors.push(`Project config validation failed: ${(error as Error).message}`);
    }
  }

  private validateRequiredFields(config: any, result: ConfigValidationResult): void {
    // Check for common required fields
    if (!config.version) {
      result.warnings.push('Missing version field in configuration');
    }

    if (config.ai && !config.ai.model) {
      result.warnings.push('No default AI model specified');
    }
  }

  // ─── Configuration Application ───────────────────────────────────────

  private async applyConfigChange(
    type: string, 
    filePath: string, 
    snapshot: ConfigSnapshot
  ): Promise<void> {
    // Record the change
    const change: ConfigChange = {
      type: type as any,
      path: filePath,
      oldValue: this.getCurrentConfig(type),
      newValue: this.loadNewConfig(type, filePath),
      timestamp: new Date(),
      validated: true
    };

    snapshot.changes.push(change);

    // Apply the change based on type
    switch (type) {
      case 'global':
        this.configManager.reload();
        break;
      case 'project':
      case 'local-project':
        this.configManager.reload();
        break;
    }

    // Notify listeners
    this.emit('config-changed', change);
  }

  private getCurrentConfig(type: string): any {
    switch (type) {
      case 'global':
        return this.configManager.getAll();
      case 'project':
        return this.configManager.getProjectSettings();
      case 'local-project':
        return (this.configManager as any).getLocalProjectSettings?.() || null;
      default:
        return null;
    }
  }

  private loadNewConfig(type: string, filePath: string): any {
    try {
      if (!filePath) return null;
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    } catch (error) {
      console.error(`[HotReload] Failed to load new config from ${filePath}:`, error);
      return null;
    }
  }

  // ─── Snapshot Management ─────────────────────────────────────────────

  private createSnapshot(changeType: string): ConfigSnapshot {
    const snapshot: ConfigSnapshot = {
      id: `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      config: this.configManager.getAll(),
      projectSettings: this.configManager.getProjectSettings(),
      localProjectSettings: (this.configManager as any).getLocalProjectSettings?.() || undefined,
      aiConfig: (this.configManager as any).getAIConfig?.() || undefined,
      changes: []
    };

    // Add to snapshots list (keep only recent ones)
    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.maxSnapshots);
    }

    return snapshot;
  }

  private async rollbackToSnapshot(snapshot: ConfigSnapshot): Promise<void> {
    try {
      console.log(`[HotReload] Rolling back to snapshot ${snapshot.id}`);

      // Restore global config
      if (snapshot.config) {
        const globalConfigPath = this.getGlobalConfigPath();
        fs.writeFileSync(globalConfigPath, JSON.stringify(snapshot.config, null, 2), { mode: 0o600 });
      }

      // Restore project config
      if (snapshot.projectSettings) {
        const projectConfigPath = this.getProjectConfigPath();
        if (projectConfigPath) {
          const projectDir = path.dirname(projectConfigPath);
          if (!fs.existsSync(projectDir)) {
            fs.mkdirSync(projectDir, { recursive: true });
          }
          fs.writeFileSync(projectConfigPath, JSON.stringify(snapshot.projectSettings, null, 2));
        }
      }

      // Restore local project config
      if (snapshot.localProjectSettings) {
        const localProjectConfigPath = this.getLocalProjectConfigPath();
        if (localProjectConfigPath) {
          const projectDir = path.dirname(localProjectConfigPath);
          if (!fs.existsSync(projectDir)) {
            fs.mkdirSync(projectDir, { recursive: true });
          }
          fs.writeFileSync(localProjectConfigPath, JSON.stringify(snapshot.localProjectSettings, null, 2));
        }
      }

      // Reload configuration
      this.configManager.reload();

      console.log(`[HotReload] Successfully rolled back to snapshot ${snapshot.id}`);
      this.emit('rollback-complete', snapshot);

    } catch (error) {
      console.error(`[HotReload] Rollback failed:`, error);
      this.emit('rollback-failed', { snapshot, error });
      throw error;
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────

  async manualReload(type?: 'global' | 'project' | 'local-project'): Promise<void> {
    if (type) {
      const filePath = this.getConfigPath(type);
      if (filePath) {
        await this.processConfigChange(type, filePath);
      }
    } else {
      // Reload all configurations
      this.configManager.reload();
      this.emit('config-reloaded', { type: 'all' });
    }
  }

  getSnapshots(): ConfigSnapshot[] {
    return [...this.snapshots];
  }

  getLatestSnapshot(): ConfigSnapshot | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
  }

  async rollbackToSnapshotId(snapshotId: string): Promise<void> {
    const snapshot = this.snapshots.find(s => s.id === snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }
    await this.rollbackToSnapshot(snapshot);
  }

  enable(): void {
    this.config.enabled = true;
    if (this.watchers.size === 0) {
      this.setupWatchers();
    }
    this.emit('hotreload-enabled');
  }

  disable(): void {
    this.config.enabled = false;
    this.stopWatching();
    this.emit('hotreload-disabled');
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getConfig(): HotReloadConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<HotReloadConfig>): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...newConfig };
    
    if (wasEnabled && !this.config.enabled) {
      this.disable();
    } else if (!wasEnabled && this.config.enabled) {
      this.enable();
    }
  }

  getStats(): {
    watchedFiles: number;
    snapshotsCount: number;
    isReloading: boolean;
    queuedChanges: number;
  } {
    return {
      watchedFiles: this.watchers.size,
      snapshotsCount: this.snapshots.length,
      isReloading: this.isReloading,
      queuedChanges: this.reloadQueue.size
    };
  }

  // ─── Cleanup ─────────────────────────────────────────────────────

  stopWatching(): void {
    // Clear debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Close file watchers
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();

    this.config.watchedFiles = [];
  }

  destroy(): void {
    this.stopWatching();
    this.removeAllListeners();
    this.snapshots = [];
    this.reloadQueue.clear();
  }

  // ─── Helper Methods ─────────────────────────────────────────────────

  private getGlobalConfigPath(): string {
    return path.join(require('os').homedir(), '.azerclaw', 'settings.json');
  }

  private getProjectConfigPath(): string | null {
    const cwd = process.cwd();
    const projectDir = path.join(cwd, '.azerclaw');
    const projectFile = path.join(projectDir, 'settings.json');
    return fs.existsSync(projectFile) ? projectFile : null;
  }

  private getLocalProjectConfigPath(): string | null {
    const cwd = process.cwd();
    const projectDir = path.join(cwd, '.azerclaw');
    const localFile = path.join(projectDir, 'settings.local.json');
    return fs.existsSync(localFile) ? localFile : null;
  }

  private getConfigPath(type: string): string | null {
    switch (type) {
      case 'global':
        return this.getGlobalConfigPath();
      case 'project':
        return this.getProjectConfigPath();
      case 'local-project':
        return this.getLocalProjectConfigPath();
      default:
        return null;
    }
  }
}

// ─── Global Hot-Reload Manager ─────────────────────────────────────────

let hotReloadManager: HotReloadManager | null = null;

export function getHotReloadManager(configManager?: ConfigManager, config?: Partial<HotReloadConfig>): HotReloadManager {
  if (!hotReloadManager) {
    if (!configManager) {
      throw new Error('ConfigManager required for first initialization');
    }
    hotReloadManager = new HotReloadManager(configManager, config);
  }
  return hotReloadManager;
}

export function initializeHotReload(configManager: ConfigManager, config?: Partial<HotReloadConfig>): HotReloadManager {
  if (hotReloadManager) {
    hotReloadManager.destroy();
  }
  hotReloadManager = new HotReloadManager(configManager, config);
  return hotReloadManager;
}

export function shutdownHotReload(): void {
  if (hotReloadManager) {
    hotReloadManager.destroy();
    hotReloadManager = null;
  }
}
