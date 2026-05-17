/**
 * 🐟 AZERCLAW HEARTBEAT System
 * Workspace-based proactive tasks that don't require restarts
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { AgentRuntime } from '../core/runtime';

// ─── HEARTBEAT Types ───────────────────────────────────────────────────

export interface HeartbeatConfig {
  enabled: boolean;
  watchInterval: number; // seconds
  workspaceDir: string;
  heartbeatFile: string;
}

export interface TaskDefinition {
  id: string;
  name: string;
  description: string;
  trigger: TaskTrigger;
  action: TaskAction;
  enabled: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  conditions?: TaskCondition[];
  timeout?: number; // seconds
  retryPolicy?: RetryPolicy;
}

export interface TaskTrigger {
  type: 'cron' | 'event' | 'file_change' | 'interval' | 'manual';
  schedule?: string; // cron expression
  event?: string; // event name
  filePattern?: string; // glob pattern
  interval?: number; // seconds
  manual?: boolean;
}

export interface TaskAction {
  type: 'agent' | 'shell' | 'workflow' | 'notification' | 'plugin';
  command?: string;
  script?: string;
  workflow?: string;
  message?: string;
  plugin?: string;
  parameters?: Record<string, any>;
}

export interface TaskCondition {
  type: 'file_exists' | 'file_modified' | 'time_range' | 'env_var' | 'custom';
  condition: string;
  expected?: any;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffType: 'fixed' | 'exponential' | 'linear';
  baseDelay: number; // seconds
  maxDelay?: number; // seconds
}

export interface TaskExecution {
  id: string;
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  result?: any;
  error?: string;
  attempt: number;
  logs: string[];
}

export interface HeartbeatFile {
  version: string;
  workspace: string;
  lastUpdated: string;
  tasks: TaskDefinition[];
  globals: Record<string, any>;
}

// ─── HEARTBEAT Manager Implementation ─────────────────────────────────

export class HeartbeatManager extends EventEmitter {
  private config: HeartbeatConfig;
  private tasks: Map<string, TaskDefinition> = new Map();
  private executions: Map<string, TaskExecution> = new Map();
  private watchers: fs.FSWatcher[] = [];
  private intervals: NodeJS.Timeout[] = [];
  private isRunning: boolean = false;
  private agentRuntime?: AgentRuntime;

  constructor(config: Partial<HeartbeatConfig> = {}) {
    super();
    
    const workspaceDir = config.workspaceDir || process.cwd();
    
    this.config = {
      enabled: true,
      watchInterval: 30,
      workspaceDir,
      heartbeatFile: path.join(workspaceDir, 'HEARTBEAT.md'),
      ...config
    };
    
    this.loadHeartbeat();
  }

  private loadHeartbeat(): void {
    try {
      if (fs.existsSync(this.config.heartbeatFile)) {
        const content = fs.readFileSync(this.config.heartbeatFile, 'utf-8');
        const heartbeat = this.parseHeartbeatFile(content);
        
        // Clear existing tasks
        this.tasks.clear();
        
        // Load tasks
        for (const task of heartbeat.tasks) {
          this.tasks.set(task.id, task);
        }
        
        console.log(`[Heartbeat] Loaded ${heartbeat.tasks.length} tasks from ${this.config.heartbeatFile}`);
        this.emit('heartbeat-loaded', heartbeat);
      } else {
        console.log(`[Heartbeat] No HEARTBEAT.md found at ${this.config.heartbeatFile}`);
        this.createDefaultHeartbeat();
      }
    } catch (error) {
      console.error('[Heartbeat] Failed to load HEARTBEAT.md:', error);
      this.createDefaultHeartbeat();
    }
  }

  private parseHeartbeatFile(content: string): HeartbeatFile {
    // Parse HEARTBEAT.md file format
    // Expected format is markdown with YAML frontmatter and task definitions
    
    const lines = content.split('\n');
    let inYaml = false;
    let yamlContent = '';
    let taskContent = '';
    
    for (const line of lines) {
      if (line === '---') {
        if (!inYaml) {
          inYaml = true;
          continue;
        } else {
          inYaml = false;
          continue;
        }
      }
      
      if (inYaml) {
        yamlContent += line + '\n';
      } else {
        taskContent += line + '\n';
      }
    }
    
    // Parse YAML frontmatter
    let frontmatter: any = {};
    try {
      if (yamlContent) {
        // Simple YAML parser (in production, use a proper YAML library)
        frontmatter = this.parseSimpleYaml(yamlContent);
      }
    } catch (error) {
      console.warn('[Heartbeat] Failed to parse YAML frontmatter:', error);
    }
    
    // Parse task definitions
    const tasks = this.parseTaskDefinitions(taskContent);
    
    return {
      version: frontmatter.version || '1.0',
      workspace: frontmatter.workspace || path.basename(this.config.workspaceDir),
      lastUpdated: new Date().toISOString(),
      tasks,
      globals: frontmatter.globals || {}
    };
  }

  private parseSimpleYaml(yaml: string): any {
    const result: any = {};
    const lines = yaml.split('\n');
    let currentKey: string | null = null;
    let inArray = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      if (trimmed.includes(':') && !trimmed.startsWith(' ')) {
        const [key, ...valueParts] = trimmed.split(':');
        const value = valueParts.join(':').trim();
        currentKey = key.trim();
        
        if (value === '') {
          result[currentKey] = {};
        } else if (value.startsWith('[') && value.endsWith(']')) {
          result[currentKey] = value.slice(1, -1).split(',').map(v => v.trim());
        } else {
          result[currentKey] = value.replace(/^["']|["']$/g, '');
        }
      } else if (currentKey && trimmed.startsWith('- ')) {
        if (!Array.isArray(result[currentKey])) {
          result[currentKey] = [];
        }
        result[currentKey].push(trimmed.slice(2).replace(/^["']|["']$/g, ''));
      }
    }
    
    return result;
  }

  private parseTaskDefinitions(content: string): TaskDefinition[] {
    const tasks: TaskDefinition[] = [];
    const sections = content.split(/##\s+(.+)/);
    
    for (let i = 1; i < sections.length; i += 2) {
      const title = sections[i].trim();
      const taskContent = sections[i + 1] || '';
      
      if (title.toLowerCase().includes('task')) {
        const task = this.parseSingleTask(title, taskContent);
        if (task) {
          tasks.push(task);
        }
      }
    }
    
    return tasks;
  }

  private parseSingleTask(title: string, content: string): TaskDefinition | null {
    try {
      const lines = content.split('\n');
      const task: Partial<TaskDefinition> = {
        id: this.generateTaskId(title),
        name: title,
        enabled: true,
        priority: 'medium'
      };
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        if (trimmed.startsWith('**Description:**')) {
          task.description = trimmed.replace('**Description:**', '').trim();
        } else if (trimmed.startsWith('**Trigger:**')) {
          task.trigger = this.parseTrigger(trimmed.replace('**Trigger:**', '').trim());
        } else if (trimmed.startsWith('**Action:**')) {
          task.action = this.parseAction(trimmed.replace('**Action:**', '').trim());
        } else if (trimmed.startsWith('**Priority:**')) {
          task.priority = trimmed.replace('**Priority:**', '').trim() as any;
        } else if (trimmed.startsWith('**Enabled:**')) {
          task.enabled = trimmed.replace('**Enabled:**', '').trim() === 'true';
        }
      }
      
      if (!task.trigger || !task.action) {
        console.warn(`[Heartbeat] Incomplete task: ${title}`);
        return null;
      }
      
      return task as TaskDefinition;
    } catch (error) {
      console.error(`[Heartbeat] Failed to parse task ${title}:`, error);
      return null;
    }
  }

  private parseTrigger(triggerStr: string): TaskTrigger {
    if (triggerStr.startsWith('cron:')) {
      return { type: 'cron', schedule: triggerStr.slice(5) };
    } else if (triggerStr.startsWith('interval:')) {
      const seconds = parseInt(triggerStr.slice(9), 10);
      return { type: 'interval', interval: seconds };
    } else if (triggerStr.startsWith('file:')) {
      return { type: 'file_change', filePattern: triggerStr.slice(5) };
    } else if (triggerStr.startsWith('event:')) {
      return { type: 'event', event: triggerStr.slice(6) };
    } else {
      return { type: 'manual', manual: true };
    }
  }

  private parseAction(actionStr: string): TaskAction {
    if (actionStr.startsWith('agent:')) {
      return { type: 'agent', command: actionStr.slice(6) };
    } else if (actionStr.startsWith('shell:')) {
      return { type: 'shell', command: actionStr.slice(6) };
    } else if (actionStr.startsWith('workflow:')) {
      return { type: 'workflow', workflow: actionStr.slice(9) };
    } else if (actionStr.startsWith('notify:')) {
      return { type: 'notification', message: actionStr.slice(8) };
    } else if (actionStr.startsWith('plugin:')) {
      return { type: 'plugin', plugin: actionStr.slice(7) };
    } else {
      return { type: 'agent', command: actionStr };
    }
  }

  private createDefaultHeartbeat(): void {
    const defaultContent = `---
version: "1.0"
workspace: "${path.basename(this.config.workspaceDir)}"
lastUpdated: "${new Date().toISOString()}"
---

# HEARTBEAT - Workspace Tasks

This file defines proactive tasks that run automatically in your workspace.

## Task: Daily Health Check

**Description:** Perform daily health check of the workspace and dependencies
**Trigger:** cron:0 9 * * *
**Action:** agent:Check workspace health and report any issues
**Priority:** medium
**Enabled:** true

## Task: Code Quality Scan

**Description:** Run code quality checks on modified files
**Trigger:** file:**/*.ts
**Action:** shell:npm run lint
**Priority:** medium
**Enabled:** true

## Task: Memory Cleanup

**Description:** Clean up old memory entries and optimize storage
**Trigger:** interval:3600
**Action:** plugin:memory-cleanup
**Priority:** low
**Enabled:** true
`;
    
    try {
      fs.writeFileSync(this.config.heartbeatFile, defaultContent, { mode: 0o644 });
      console.log(`[Heartbeat] Created default HEARTBEAT.md at ${this.config.heartbeatFile}`);
      this.loadHeartbeat();
    } catch (error) {
      console.error('[Heartbeat] Failed to create default HEARTBEAT.md:', error);
    }
  }

  start(agentRuntime?: AgentRuntime): void {
    if (this.isRunning) {
      return;
    }
    
    this.agentRuntime = agentRuntime;
    this.isRunning = true;
    
    console.log('[Heartbeat] Starting workspace task monitoring...');
    
    // Set up file watcher
    this.setupFileWatcher();
    
    // Set up interval-based tasks
    this.setupIntervalTasks();
    
    // Schedule cron-based tasks
    this.scheduleCronTasks();
    
    this.emit('heartbeat-started');
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }
    
    console.log('[Heartbeat] Stopping workspace task monitoring...');
    
    // Clear file watchers
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
    
    // Clear intervals
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals = [];
    
    this.isRunning = false;
    this.emit('heartbeat-stopped');
  }

  private setupFileWatcher(): void {
    try {
      const watcher = fs.watch(this.config.heartbeatFile, (eventType) => {
        if (eventType === 'change') {
          console.log('[Heartbeat] HEARTBEAT.md modified, reloading tasks...');
          setTimeout(() => {
            this.loadHeartbeat();
            this.emit('heartbeat-reloaded');
          }, 100); // Small delay to ensure file is fully written
        }
      });
      
      this.watchers.push(watcher);
    } catch (error) {
      console.error('[Heartbeat] Failed to setup file watcher:', error);
    }
  }

  private setupIntervalTasks(): void {
    // Clear existing intervals to prevent duplicates on reload
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals = [];

    for (const task of this.tasks.values()) {
      if (task.enabled && task.trigger.type === 'interval' && task.trigger.interval) {
        const interval = setInterval(() => {
          this.executeTask(task.id);
        }, task.trigger.interval * 1000);
        
        this.intervals.push(interval);
      }
    }
  }

  private scheduleCronTasks(): void {
    // Simple cron scheduling (in production, use a proper cron library)
    for (const task of this.tasks.values()) {
      if (task.enabled && task.trigger.type === 'cron' && task.trigger.schedule) {
        // For now, just log that we would schedule it
        console.log(`[Heartbeat] Would schedule cron task: ${task.name} (${task.trigger.schedule})`);
        // In a real implementation, parse cron expression and schedule appropriately
      }
    }
  }

  async executeTask(taskId: string, manual = false): Promise<TaskExecution> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    if (!manual && !task.enabled) {
      throw new Error(`Task is disabled: ${taskId}`);
    }
    
    // Check conditions
    if (!manual && task.conditions && !this.checkConditions(task.conditions)) {
      console.log(`[Heartbeat] Task conditions not met: ${task.name}`);
      const execution: TaskExecution = {
        id: this.generateExecutionId(),
        taskId,
        status: 'cancelled',
        startTime: new Date(),
        attempt: 1,
        logs: ['Task conditions not met']
      };
      this.executions.set(execution.id, execution);
      return execution;
    }
    
    const execution: TaskExecution = {
      id: this.generateExecutionId(),
      taskId,
      status: 'running',
      startTime: new Date(),
      attempt: 1,
      logs: [`Starting task: ${task.name}`]
    };
    
    this.executions.set(execution.id, execution);
    this.emit('task-started', execution);
    
    try {
      console.log(`[Heartbeat] Executing task: ${task.name}`);
      
      const result = await this.performTaskAction(task.action, execution);
      
      execution.status = 'completed';
      execution.endTime = new Date();
      execution.result = result;
      execution.logs.push(`Task completed successfully`);
      
      console.log(`[Heartbeat] Task completed: ${task.name}`);
      this.emit('task-completed', execution);
      
    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.error = (error as Error).message;
      execution.logs.push(`Task failed: ${(error as Error).message}`);
      
      console.error(`[Heartbeat] Task failed: ${task.name} - ${(error as Error).message}`);
      this.emit('task-failed', execution);
      
      // Handle retry logic
      if (task.retryPolicy && execution.attempt < task.retryPolicy.maxAttempts) {
        console.log(`[Heartbeat] Retrying task ${task.name} (attempt ${execution.attempt + 1}/${task.retryPolicy.maxAttempts})`);
        setTimeout(async () => {
          execution.attempt++;
          execution.status = 'running';
          execution.endTime = undefined;
          execution.error = undefined;
          execution.logs.push(`Retry attempt ${execution.attempt}`);
          this.emit('task-retry', execution);
          try {
            const result = await this.performTaskAction(task.action, execution);
            execution.status = 'completed';
            execution.endTime = new Date();
            execution.result = result;
            execution.logs.push('Task completed on retry');
            this.emit('task-completed', execution);
          } catch (retryError) {
            execution.status = 'failed';
            execution.endTime = new Date();
            execution.error = (retryError as Error).message;
            execution.logs.push(`Retry failed: ${(retryError as Error).message}`);
            this.emit('task-failed', execution);
          }
        }, this.calculateRetryDelay(task.retryPolicy, execution.attempt));
      }
    }
    
    return execution;
  }

  private async performTaskAction(action: TaskAction, execution: TaskExecution): Promise<any> {
    execution.logs.push(`Performing action: ${action.type}`);
    
    switch (action.type) {
      case 'agent':
        if (!this.agentRuntime) {
          throw new Error('Agent runtime not available');
        }
        // Execute agent command
        return this.executeAgentCommand(action.command!, execution);
        
      case 'shell':
        return this.executeShellCommand(action.command!, execution);
        
      case 'workflow':
        return this.executeWorkflow(action.workflow!, execution);
        
      case 'notification':
        return this.sendNotification(action.message!, execution);
        
      case 'plugin':
        return this.executePluginAction(action.plugin!, action.parameters, execution);
        
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async executeAgentCommand(command: string, execution: TaskExecution): Promise<any> {
    // This would integrate with the agent runtime
    execution.logs.push(`Executing agent command: ${command}`);
    return { command, result: 'Agent command executed' };
  }

  private async executeShellCommand(command: string, execution: TaskExecution): Promise<any> {
    const { execSync } = require('child_process');
    
    try {
      execution.logs.push(`Executing shell command: ${command}`);
      const output = execSync(command, { encoding: 'utf-8', cwd: this.config.workspaceDir });
      execution.logs.push(`Command output: ${output}`);
      return { command, output };
    } catch (error: any) {
      execution.logs.push(`Command error: ${error.message}`);
      throw error;
    }
  }

  private async executeWorkflow(workflowName: string, execution: TaskExecution): Promise<any> {
    // This would integrate with the workflow engine
    execution.logs.push(`Executing workflow: ${workflowName}`);
    return { workflow: workflowName, result: 'Workflow executed' };
  }

  private async sendNotification(message: string, execution: TaskExecution): Promise<any> {
    console.log(`[Heartbeat Notification] ${message}`);
    execution.logs.push(`Notification sent: ${message}`);
    return { message, sent: true };
  }

  private async executePluginAction(pluginName: string, parameters: any, execution: TaskExecution): Promise<any> {
    // This would integrate with the plugin system
    execution.logs.push(`Executing plugin action: ${pluginName}`);
    return { plugin: pluginName, parameters, result: 'Plugin action executed' };
  }

  private checkConditions(conditions: TaskCondition[]): boolean {
    for (const condition of conditions) {
      if (!this.checkCondition(condition)) {
        return false;
      }
    }
    return true;
  }

  private checkCondition(condition: TaskCondition): boolean {
    switch (condition.type) {
      case 'file_exists':
        return fs.existsSync(path.join(this.config.workspaceDir, condition.condition));
      
      case 'env_var':
        return process.env[condition.condition] === condition.expected;
      
      case 'time_range':
        // Simple time range check
        return true; // Implement as needed
      
      default:
        return true;
    }
  }

  private calculateRetryDelay(retryPolicy: RetryPolicy, attempt: number): number {
    let delay = retryPolicy.baseDelay;
    
    switch (retryPolicy.backoffType) {
      case 'exponential':
        delay = retryPolicy.baseDelay * Math.pow(2, attempt - 1);
        break;
      case 'linear':
        delay = retryPolicy.baseDelay * attempt;
        break;
      case 'fixed':
      default:
        delay = retryPolicy.baseDelay;
        break;
    }
    
    if (retryPolicy.maxDelay && delay > retryPolicy.maxDelay) {
      delay = retryPolicy.maxDelay;
    }
    
    return delay * 1000; // Convert to milliseconds
  }

  private generateTaskId(title: string): string {
    return title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 20);
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ─── Public API ─────────────────────────────────────────────────────

  getTasks(): TaskDefinition[] {
    return Array.from(this.tasks.values());
  }

  getTask(id: string): TaskDefinition | undefined {
    return this.tasks.get(id);
  }

  getExecutions(): TaskExecution[] {
    return Array.from(this.executions.values())
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  getExecution(id: string): TaskExecution | undefined {
    return this.executions.get(id);
  }

  async reload(): Promise<void> {
    this.loadHeartbeat();
    this.emit('heartbeat-reloaded');
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getStats(): {
    totalTasks: number;
    enabledTasks: number;
    runningExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
  } {
    const executions = Array.from(this.executions.values());
    
    return {
      totalTasks: this.tasks.size,
      enabledTasks: Array.from(this.tasks.values()).filter(t => t.enabled).length,
      runningExecutions: executions.filter(e => e.status === 'running').length,
      completedExecutions: executions.filter(e => e.status === 'completed').length,
      failedExecutions: executions.filter(e => e.status === 'failed').length
    };
  }
}

// ─── Global Heartbeat Manager ─────────────────────────────────────────

let heartbeatManager: HeartbeatManager | null = null;

export function getHeartbeatManager(config?: Partial<HeartbeatConfig>): HeartbeatManager {
  if (!heartbeatManager) {
    heartbeatManager = new HeartbeatManager(config);
  }
  return heartbeatManager;
}

export function initializeHeartbeat(agentRuntime?: AgentRuntime, config?: Partial<HeartbeatConfig>): HeartbeatManager {
  const manager = getHeartbeatManager(config);
  manager.start(agentRuntime);
  return manager;
}

export function shutdownHeartbeat(): void {
  if (heartbeatManager) {
    heartbeatManager.stop();
    heartbeatManager = null;
  }
}
