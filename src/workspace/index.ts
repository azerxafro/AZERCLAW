/**
 * 🐟 AZERCLAW Workspace System
 * Workspace management and HEARTBEAT task system
 */

export * from './heartbeat';

import { HeartbeatManager, getHeartbeatManager } from './heartbeat';
import { AgentRuntime } from '../core/runtime';

// ─── Workspace Manager ─────────────────────────────────────────────────

export interface WorkspaceConfig {
  workspaceDir: string;
  heartbeatEnabled: boolean;
  autoStart: boolean;
  watchFiles: boolean;
}

export class WorkspaceManager {
  private config: WorkspaceConfig;
  private heartbeatManager: HeartbeatManager;
  private agentRuntime?: AgentRuntime;

  constructor(config: Partial<WorkspaceConfig> = {}) {
    this.config = {
      workspaceDir: process.cwd(),
      heartbeatEnabled: true,
      autoStart: true,
      watchFiles: true,
      ...config
    };
    
    this.heartbeatManager = getHeartbeatManager({
      workspaceDir: this.config.workspaceDir,
      enabled: this.config.heartbeatEnabled
    });
  }

  async initialize(agentRuntime?: AgentRuntime): Promise<void> {
    this.agentRuntime = agentRuntime;
    
    if (this.config.autoStart) {
      await this.start();
    }
  }

  async start(): Promise<void> {
    console.log(`[Workspace] Starting workspace management for: ${this.config.workspaceDir}`);
    
    if (this.config.heartbeatEnabled) {
      this.heartbeatManager.start(this.agentRuntime);
    }
  }

  async stop(): Promise<void> {
    console.log('[Workspace] Stopping workspace management');
    
    this.heartbeatManager.stop();
  }

  getHeartbeatManager(): HeartbeatManager {
    return this.heartbeatManager;
  }

  getConfig(): WorkspaceConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<WorkspaceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update heartbeat manager if needed
    if (newConfig.workspaceDir) {
      this.heartbeatManager = getHeartbeatManager({
        workspaceDir: this.config.workspaceDir,
        enabled: this.config.heartbeatEnabled
      });
    }
  }
}

// ─── Global Workspace Manager ─────────────────────────────────────────

let workspaceManager: WorkspaceManager | null = null;

export function getWorkspaceManager(config?: Partial<WorkspaceConfig>): WorkspaceManager {
  if (!workspaceManager) {
    workspaceManager = new WorkspaceManager(config);
  }
  return workspaceManager;
}

export async function initializeWorkspace(agentRuntime?: AgentRuntime, config?: Partial<WorkspaceConfig>): Promise<WorkspaceManager> {
  const manager = getWorkspaceManager(config);
  await manager.initialize(agentRuntime);
  return manager;
}

export function shutdownWorkspace(): void {
  if (workspaceManager) {
    workspaceManager.stop();
    workspaceManager = null;
  }
}
