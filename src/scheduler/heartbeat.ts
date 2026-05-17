/**
 * 🐟 AZERCLAW Heartbeat Scheduler
 * Proactive background task execution on a configurable schedule.
 * Reads HEARTBEAT.md for task definitions and runs them on cron intervals.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Cron } from 'croner';
import { AgentRuntime, AgentEvent } from '../core/runtime';
import { getConfigManager } from '../config/manager';
import { auditLog } from '../core/security';

// ─── Types ──────────────────────────────────────────────────────

export interface HeartbeatTask {
  name: string;
  schedule: string;        // cron expression or human-readable
  action: string;          // Task description for the agent
  condition?: string;      // Condition to check before running
  enabled: boolean;
  lastRun?: Date;
  lastResult?: string;
}

export interface HeartbeatConfig {
  intervalMinutes: number;
  tasks: HeartbeatTask[];
  suppressIfNoAction: boolean;
}

// ─── Schedule Parsing ───────────────────────────────────────────

function humanToCron(schedule: string): string {
  const s = schedule.toLowerCase().trim();
  
  // Pre-defined schedules
  if (s === 'every 30 minutes' || s === 'every 30m') return '*/30 * * * *';
  if (s === 'every hour' || s === 'every 1h') return '0 * * * *';
  if (s === 'every 6 hours' || s === 'every 6h') return '0 */6 * * *';
  if (s === 'every 12 hours' || s === 'every 12h') return '0 */12 * * *';
  if (s === 'daily' || s === 'every day') return '0 9 * * *';
  if (s === 'weekly' || s === 'every week') return '0 9 * * 1';
  if (s.startsWith('daily at ')) {
    const time = s.replace('daily at ', '');
    const [h, m] = time.split(':').map(Number);
    return `${m || 0} ${h} * * *`;
  }
  if (s.startsWith('weekly on ')) {
    const day = s.replace('weekly on ', '').toLowerCase();
    const dayMap: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6,
    };
    return `0 9 * * ${dayMap[day] ?? 1}`;
  }
  
  // Match "every N minutes/hours" pattern
  const everyMatch = s.match(/every (\d+) (minutes?|hours?)/);
  if (everyMatch) {
    const n = parseInt(everyMatch[1]);
    const unit = everyMatch[2];
    if (unit.startsWith('minute')) return `*/${n} * * * *`;
    if (unit.startsWith('hour')) return `0 */${n} * * *`;
  }
  
  // Assume it's already a cron expression
  return schedule;
}

// ─── HEARTBEAT.md Parser ────────────────────────────────────────

function parseHeartbeatFile(filePath: string): HeartbeatTask[] {
  if (!fs.existsSync(filePath)) return [];
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const tasks: HeartbeatTask[] = [];
  
  // Parse markdown sections: ### Task Name
  const sections = content.split(/^### /m).slice(1);
  
  for (const section of sections) {
    const lines = section.split('\n');
    const name = lines[0].trim();
    
    let schedule = 'every 30 minutes';
    let action = '';
    let condition = '';
    let enabled = true;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- **Schedule**:')) {
        schedule = trimmed.replace('- **Schedule**:', '').trim();
      } else if (trimmed.startsWith('- **Action**:')) {
        action = trimmed.replace('- **Action**:', '').trim();
      } else if (trimmed.startsWith('- **Condition**:')) {
        condition = trimmed.replace('- **Condition**:', '').trim();
      } else if (trimmed.startsWith('- **Enabled**:')) {
        enabled = trimmed.replace('- **Enabled**:', '').trim().toLowerCase() !== 'false';
      }
    }
    
    if (name && action) {
      tasks.push({ name, schedule, action, condition, enabled });
    }
  }
  
  return tasks;
}

// ─── Heartbeat Engine ───────────────────────────────────────────

export class HeartbeatEngine {
  private jobs: Map<string, Cron> = new Map();
  private tasks: HeartbeatTask[] = [];
  private running = false;
  private eventCallback: ((event: string, details: string) => void) | null = null;

  constructor(private heartbeatPath?: string) {
    const configDir = getConfigManager().paths.configDir;
    this.heartbeatPath = heartbeatPath || path.join(configDir, 'HEARTBEAT.md');
  }

  /**
   * Set callback for heartbeat events (for messenger integration).
   */
  onEvent(callback: (event: string, details: string) => void): void {
    this.eventCallback = callback;
  }

  /**
   * Load tasks from HEARTBEAT.md and start all cron jobs.
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    
    // Copy default HEARTBEAT.md if none exists
    if (!fs.existsSync(this.heartbeatPath!)) {
      const templatePath = path.join(__dirname, '..', '..', 'templates', 'HEARTBEAT.md');
      if (fs.existsSync(templatePath)) {
        fs.copyFileSync(templatePath, this.heartbeatPath!);
      }
    }
    
    this.tasks = parseHeartbeatFile(this.heartbeatPath!);
    
    for (const task of this.tasks) {
      if (!task.enabled) continue;
      
      const cronExpr = humanToCron(task.schedule);
      try {
        const job = new Cron(cronExpr, async () => {
          await this.executeTask(task);
        });
        this.jobs.set(task.name, job);
        auditLog('HEARTBEAT_SCHEDULED', `${task.name} → ${cronExpr}`);
      } catch (e: any) {
        auditLog('HEARTBEAT_ERROR', `Failed to schedule ${task.name}: ${e.message}`);
      }
    }
    
    auditLog('HEARTBEAT_STARTED', `${this.jobs.size} tasks scheduled`);
  }

  /**
   * Stop all cron jobs.
   */
  stop(): void {
    for (const [name, job] of this.jobs) {
      job.stop();
    }
    this.jobs.clear();
    this.running = false;
    auditLog('HEARTBEAT_STOPPED', 'All tasks stopped');
  }

  /**
   * Execute a single heartbeat task.
   */
  private async executeTask(task: HeartbeatTask): Promise<void> {
    auditLog('HEARTBEAT_RUN', task.name);
    
    // Check condition
    if (task.condition) {
      const conditionMet = await this.checkCondition(task.condition);
      if (!conditionMet) {
        auditLog('HEARTBEAT_SKIP', `${task.name} — condition not met`);
        return;
      }
    }
    
    // Refuse obviously destructive actions in heartbeat (no human in the loop).
    const ACTION_DENY = [
      /\brm\s+-rf?\s+\//i,
      /\bsudo\b/i,
      /\bshutdown\b|\breboot\b|\bhalt\b/i,
      /\bmkfs(\.|\s)/i,
      /\b(curl|wget)\b[^|]*\|\s*(sh|bash|zsh)/i,
    ];
    for (const pattern of ACTION_DENY) {
      if (pattern.test(task.action)) {
        auditLog('HEARTBEAT_REFUSED', `${task.name} matched deny pattern ${pattern}`);
        return;
      }
    }

    // Run the task via a temporary agent. No turbo flag — approvals stay enforced.
    let result = '';
    const agent = new AgentRuntime({
      sessionId: `heartbeat_${task.name}_${Date.now()}`,
      maxIterations: 5,
      eventHandler: async (event: AgentEvent) => {
        if (event.type === 'response' && event.content) {
          result = event.content;
        }
      },
    });

    try {
      result = await agent.run(task.action);
      task.lastRun = new Date();
      task.lastResult = result.slice(0, 500);

      if (result && this.eventCallback) {
        this.eventCallback(`heartbeat:${task.name}`, result);
      }

      auditLog('HEARTBEAT_DONE', `${task.name} — ${result.slice(0, 100)}`);
    } catch (e: any) {
      auditLog('HEARTBEAT_ERROR', `${task.name} — ${e.message}`);
    } finally {
      // Release any sub-agents / pending work before the reference drops.
      try { agent.abort(); } catch { /* ignore */ }
    }
  }

  /**
   * Check if a condition is met (simple heuristic checks).
   */
  private async checkCondition(condition: string): Promise<boolean> {
    const c = condition.toLowerCase();
    
    if (c.includes('git repo')) {
      return fs.existsSync(path.join(process.cwd(), '.git'));
    }
    if (c.includes('package.json')) {
      return fs.existsSync(path.join(process.cwd(), 'package.json'));
    }
    if (c === 'always') {
      return true;
    }
    
    return true; // Default: run
  }

  /**
   * Get status of all tasks.
   */
  getStatus(): { name: string; schedule: string; nextRun: string; lastRun: string; enabled: boolean }[] {
    return this.tasks.map(task => {
      const job = this.jobs.get(task.name);
      return {
        name: task.name,
        schedule: task.schedule,
        nextRun: job?.nextRun()?.toISOString() || 'not scheduled',
        lastRun: task.lastRun?.toISOString() || 'never',
        enabled: task.enabled,
      };
    });
  }

  /**
   * Manually trigger a task by name.
   */
  async triggerTask(name: string): Promise<string> {
    const task = this.tasks.find(t => t.name === name);
    if (!task) return `Task not found: ${name}`;
    await this.executeTask(task);
    return task.lastResult || 'Task completed';
  }
}
