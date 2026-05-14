/**
 * 🐟 AZERCLAW Terminal Dashboard
 * Rich terminal dashboard with real-time updates and interactive elements
 */

import * as chalk from 'chalk';
import { EventEmitter } from 'events';
import { 
  TerminalCharts, 
  TerminalProgress, 
  TerminalCards, 
  TerminalTables, 
  TerminalAnimations,
  TerminalUtils
} from './visualizations';
import { getPluginManager } from '../../plugins';
// Note: VectorContextStore is optional
// import { getSessionStore, getVectorContextStore } from '../../memory/store';
import { getSessionStore } from '../../memory/store';
import { getHeartbeatManager } from '../../workspace';

// ─── Dashboard Types ───────────────────────────────────────────────────

export interface DashboardConfig {
  refreshInterval: number; // seconds
  autoRefresh: boolean;
  showAnimations: boolean;
  colorScheme: 'default' | 'dark' | 'light';
  layout: 'compact' | 'spacious' | 'minimal';
}

export interface DashboardMetrics {
  system: {
    cpu: number;
    memory: {
      used: number;
      total: number;
    };
    uptime: number;
  };
  azerclaw: {
    sessions: number;
    tokens: number;
    plugins: number;
    tools: number;
  };
  performance: {
    responseTime: number;
    throughput: number;
    errorRate: number;
  };
  workspace: {
    tasks: number;
    activeTasks: number;
    completedTasks: number;
  };
}

// ─── Dashboard Implementation ─────────────────────────────────────────

export class TerminalDashboard extends EventEmitter {
  private config: DashboardConfig;
  private isRunning: boolean = false;
  private refreshTimer: NodeJS.Timeout | null = null;
  private animationFrame: number = 0;
  private lastMetrics: DashboardMetrics | null = null;

  constructor(config: Partial<DashboardConfig> = {}) {
    super();
    
    this.config = {
      refreshInterval: 5,
      autoRefresh: true,
      showAnimations: true,
      colorScheme: 'default',
      layout: 'spacious',
      ...config
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    console.clear();
    
    // Display initial dashboard
    await this.renderDashboard();
    
    // Start auto-refresh
    if (this.config.autoRefresh) {
      this.startAutoRefresh();
    }
    
    console.log(chalk.green('\n🐟 AZERCLAW Dashboard started. Press Ctrl+C to exit.\n'));
    this.emit('dashboard-started');
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    this.emit('dashboard-stopped');
  }

  private startAutoRefresh(): void {
    this.refreshTimer = setInterval(async () => {
      if (this.isRunning) {
        await this.refreshDashboard();
      }
    }, this.config.refreshInterval * 1000);
  }

  async refreshDashboard(): Promise<void> {
    // Save cursor position
    process.stdout.write('\u001b[s');
    
    // Move to top
    process.stdout.write('\u001b[H');
    
    // Re-render dashboard
    await this.renderDashboard();
    
    // Restore cursor position
    process.stdout.write('\u001b[u');
  }

  private async renderDashboard(): Promise<void> {
    const metrics = await this.collectMetrics();
    this.lastMetrics = metrics;
    
    // Render header
    this.renderHeader();
    
    // Render based on layout
    switch (this.config.layout) {
      case 'compact':
        this.renderCompactLayout(metrics);
        break;
      case 'minimal':
        this.renderMinimalLayout(metrics);
        break;
      case 'spacious':
      default:
        this.renderSpaciousLayout(metrics);
        break;
    }
    
    // Render footer
    this.renderFooter();
    
    // Update animation frame
    if (this.config.showAnimations) {
      this.animationFrame++;
    }
  }

  private renderHeader(): void {
    const time = new Date().toLocaleString();
    const header = TerminalUtils.renderHeader('🐟 AZERCLAW Terminal Dashboard', 80);
    
    console.log(header);
    console.log(chalk.dim(`Last updated: ${time}`));
    console.log();
  }

  private renderSpaciousLayout(metrics: DashboardMetrics): void {
    // System metrics row
    console.log(chalk.bold.cyan('📊 System Metrics'));
    const systemCards = [
      {
        title: 'CPU Usage',
        value: `${metrics.system.cpu.toFixed(1)}%`,
        change: 0,
        unit: '',
        icon: '🔥',
        color: metrics.system.cpu > 80 ? 'red' : metrics.system.cpu > 50 ? 'yellow' : 'green'
      },
      {
        title: 'Memory',
        value: TerminalUtils.formatBytes(metrics.system.memory.used),
        change: 0,
        unit: `/ ${TerminalUtils.formatBytes(metrics.system.memory.total)}`,
        icon: '💾',
        color: 'blue'
      },
      {
        title: 'Uptime',
        value: TerminalUtils.formatDuration(metrics.system.uptime),
        icon: '⏰',
        color: 'magenta'
      }
    ];
    
    console.log(TerminalCards.renderDashboard(systemCards, 3));
    console.log();
    
    // AZERCLAW metrics row
    console.log(chalk.bold.cyan('🤖 AZERCLAW Metrics'));
    const azerclawCards = [
      {
        title: 'Sessions',
        value: metrics.azerclaw.sessions,
        change: 0,
        icon: '💬',
        color: 'green'
      },
      {
        title: 'Tokens',
        value: TerminalUtils.formatBytes(metrics.azerclaw.tokens),
        icon: '🪙',
        color: 'yellow'
      },
      {
        title: 'Plugins',
        value: metrics.azerclaw.plugins,
        icon: '🔌',
        color: 'cyan'
      },
      {
        title: 'Tools',
        value: metrics.azerclaw.tools,
        icon: '🛠️',
        color: 'white'
      }
    ];
    
    console.log(TerminalCards.renderDashboard(azerclawCards, 4));
    console.log();
    
    // Performance charts
    console.log(chalk.bold.cyan('📈 Performance'));
    
    // Response time chart
    const responseTimeData = {
      labels: ['1m', '2m', '3m', '4m', '5m'],
      datasets: [{
        label: 'Response Time (ms)',
        data: [120, 95, 110, 85, metrics.performance.responseTime],
        color: 'green'
      }]
    };
    
    console.log(TerminalCharts.renderLineChart(responseTimeData, 60, 10));
    console.log();
    
    // Workspace tasks
    console.log(chalk.bold.cyan('📋 Workspace Tasks'));
    const taskProgress = {
      current: metrics.workspace.completedTasks,
      total: metrics.workspace.tasks,
      label: 'Tasks Completed',
      color: 'blue'
    };
    
    console.log(TerminalProgress.renderProgressBar(taskProgress, 50));
    console.log();
    
    // Recent activity table
    console.log(chalk.bold.cyan('📝 Recent Activity'));
    const activityTable = {
      headers: ['Time', 'Type', 'Description'],
      rows: [
        ['2m ago', 'Plugin', 'Context Engine loaded'],
        ['5m ago', 'Session', 'New chat session started'],
        ['8m ago', 'Task', 'Daily health check completed'],
        ['12m ago', 'Memory', 'Vector store optimized'],
        ['15m ago', 'Config', 'Settings reloaded']
      ],
      alignments: ['left' as const, 'left' as const, 'left' as const]
    };
    
    console.log(TerminalTables.renderTable(activityTable, 80));
  }

  private renderCompactLayout(metrics: DashboardMetrics): void {
    // Single line with key metrics
    const statusLine = [
      chalk.cyan(`CPU: ${metrics.system.cpu.toFixed(1)}%`),
      chalk.blue(`Mem: ${TerminalUtils.formatBytes(metrics.system.memory.used)}`),
      chalk.green(`Sessions: ${metrics.azerclaw.sessions}`),
      chalk.yellow(`Plugins: ${metrics.azerclaw.plugins}`),
      chalk.magenta(`Tasks: ${metrics.workspace.activeTasks}/${metrics.workspace.tasks}`)
    ].join(' | ');
    
    console.log(statusLine);
    
    // Mini charts
    const chartData = {
      labels: ['1', '2', '3', '4', '5'],
      datasets: [{
        label: 'Response Time',
        data: [120, 95, 110, 85, metrics.performance.responseTime],
        color: 'green'
      }]
    };
    
    console.log(TerminalCharts.renderBarChart(chartData, 40, 6));
  }

  private renderMinimalLayout(metrics: DashboardMetrics): void {
    // Just essential metrics
    console.log(`🐟 AZERCLAW: ${metrics.azerclaw.sessions} sessions | ${metrics.system.cpu.toFixed(1)}% CPU | ${metrics.workspace.activeTasks} active tasks`);
  }

  private renderFooter(): void {
    const time = new Date().toLocaleTimeString();
    
    console.log();
    console.log(TerminalUtils.renderSeparator('─', 80));
    
    // Status indicators
    const indicators = [
      { icon: '🟢', label: 'System Healthy' },
      { icon: '🔌', label: `${this.lastMetrics?.azerclaw.plugins || 0} Plugins` },
      { icon: '📊', label: 'Auto-refresh' },
      { icon: '⏰', label: time }
    ];
    
    const footerLine = indicators.map(ind => `${ind.icon} ${ind.label}`).join('  ');
    console.log(chalk.dim(footerLine));
    
    if (this.config.showAnimations) {
      // Add a small animation
      const animation = TerminalAnimations.renderWave(this.animationFrame * 0.1, 80, 3);
      console.log(animation);
    }
  }

  private async collectMetrics(): Promise<DashboardMetrics> {
    // System metrics
    const systemMetrics = this.getSystemMetrics();
    
    // AZERCLAW metrics
    const azerclawMetrics = await this.getAzerclawMetrics();
    
    // Performance metrics (mock for now)
    const performanceMetrics = {
      responseTime: 85 + Math.random() * 40,
      throughput: 100 + Math.random() * 20,
      errorRate: Math.random() * 5
    };
    
    // Workspace metrics
    const workspaceMetrics = await this.getWorkspaceMetrics();
    
    return {
      system: systemMetrics,
      azerclaw: azerclawMetrics,
      performance: performanceMetrics,
      workspace: workspaceMetrics
    };
  }

  private getSystemMetrics() {
    const memUsage = process.memoryUsage();
    
    return {
      cpu: Math.random() * 100, // Mock CPU usage
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal
      },
      uptime: process.uptime()
    };
  }

  private async getAzerclawMetrics() {
    try {
      const sessionStore = getSessionStore();
      const sessions = sessionStore.list(1000);
      
      const pluginManager = getPluginManager();
      const plugins = await pluginManager.listPlugins();
      
      return {
        sessions: sessions.length,
        tokens: 50000 + Math.floor(Math.random() * 10000), // Mock token count
        plugins: plugins.length,
        tools: 25 // Mock tool count
      };
    } catch (error) {
      return {
        sessions: 0,
        tokens: 0,
        plugins: 0,
        tools: 0
      };
    }
  }

  private async getWorkspaceMetrics() {
    try {
      const heartbeatManager = getHeartbeatManager();
      const stats = heartbeatManager.getStats();
      
      return {
        tasks: stats.totalTasks,
        activeTasks: stats.runningExecutions,
        completedTasks: stats.completedExecutions
      };
    } catch (error) {
      return {
        tasks: 0,
        activeTasks: 0,
        completedTasks: 0
      };
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────

  async showPluginStatus(): Promise<void> {
    console.log(chalk.bold.cyan('🔌 Plugin Status'));
    
    try {
      const pluginManager = getPluginManager();
      const plugins = await pluginManager.listPlugins();
      
      if (plugins.length === 0) {
        console.log(chalk.yellow('No plugins loaded'));
        return;
      }
      
      const pluginTable = {
        headers: ['Plugin', 'Version', 'Status', 'Tools'],
        rows: plugins.map(plugin => [
          plugin.plugin.metadata.name,
          plugin.plugin.metadata.version,
          plugin.status,
          plugin.plugin.tools?.length.toString() || '0'
        ]),
        alignments: ['left' as const, 'center' as const, 'center' as const, 'center' as const]
      };
      
      console.log(TerminalTables.renderTable(pluginTable, 80));
    } catch (error) {
      console.error(chalk.red('Failed to get plugin status:'), error);
    }
  }

  async showMemoryStats(): Promise<void> {
    console.log(chalk.bold.cyan('💾 Memory Statistics'));
    
    try {
      const sessionStore = getSessionStore();
      const stats = sessionStore.getGlobalUsage();
      
      const memoryCards = [
        {
          title: 'Total Tokens',
          value: stats.totalTokens.toLocaleString(),
          icon: '🪙',
          color: 'yellow'
        },
        {
          title: 'Sessions',
          value: Object.keys(stats.dailyTokens).length,
          icon: '💬',
          color: 'green'
        },
        {
          title: 'Daily Avg',
          value: Math.round(Object.values(stats.dailyTokens).reduce((a, b) => a + b, 0) / Object.keys(stats.dailyTokens).length),
          icon: '📊',
          color: 'blue'
        }
      ];
      
      console.log(TerminalCards.renderDashboard(memoryCards, 3));
      
      // Show daily usage chart
      const dailyData = {
        labels: Object.keys(stats.dailyTokens).slice(-7),
        datasets: [{
          label: 'Daily Token Usage',
          data: Object.values(stats.dailyTokens).slice(-7),
          color: 'green'
        }]
      };
      
      console.log();
      console.log(TerminalCharts.renderBarChart(dailyData, 60, 8));
    } catch (error) {
      console.error(chalk.red('Failed to get memory stats:'), error);
    }
  }

  async showTaskStatus(): Promise<void> {
    console.log(chalk.bold.cyan('📋 Task Status'));
    
    try {
      const heartbeatManager = getHeartbeatManager();
      const stats = heartbeatManager.getStats();
      const tasks = heartbeatManager.getTasks();
      const executions = heartbeatManager.getExecutions();
      
      // Task overview cards
      const taskCards = [
        {
          title: 'Total Tasks',
          value: stats.totalTasks,
          icon: '📋',
          color: 'blue'
        },
        {
          title: 'Enabled',
          value: stats.enabledTasks,
          icon: '✅',
          color: 'green'
        },
        {
          title: 'Running',
          value: stats.runningExecutions,
          icon: '🏃',
          color: 'yellow'
        },
        {
          title: 'Completed',
          value: stats.completedExecutions,
          icon: '✨',
          color: 'green'
        }
      ];
      
      console.log(TerminalCards.renderDashboard(taskCards, 4));
      
      // Recent executions
      const executionTable = {
        headers: ['Task', 'Status', 'Started', 'Duration'],
        rows: executions.slice(0, 5).map(exec => [
          heartbeatManager.getTask(exec.taskId)?.name || exec.taskId,
          exec.status,
          new Date(exec.startTime).toLocaleTimeString(),
          exec.endTime ? TerminalUtils.formatDuration(exec.endTime.getTime() - exec.startTime.getTime()) : 'Running'
        ]),
        alignments: ['left' as const, 'center' as const, 'center' as const, 'center' as const]
      };
      
      console.log(TerminalTables.renderTable(executionTable, 80));
    } catch (error) {
      console.error(chalk.red('Failed to get task status:'), error);
    }
  }

  getConfig(): DashboardConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<DashboardConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart auto-refresh if interval changed
    if (newConfig.refreshInterval && this.refreshTimer) {
      clearInterval(this.refreshTimer);
      if (this.config.autoRefresh) {
        this.startAutoRefresh();
      }
    }
  }

  getLastMetrics(): DashboardMetrics | null {
    return this.lastMetrics;
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

// ─── Dashboard Controls ─────────────────────────────────────────────────

export class DashboardControls {
  private dashboard: TerminalDashboard;
  private keyHandler: (key: string) => void;
  private keypressListener: ((str: string, key: any) => void) | null = null;

  constructor(dashboard: TerminalDashboard) {
    this.dashboard = dashboard;
    this.keyHandler = this.handleKey.bind(this);
    this.setupKeyHandlers();
  }

  private handleKey(key: string): void {
    switch (key) {
      case 'q':
      case 'Q':
        this.dashboard.stop();
        process.exit(0);
        break;
        
      case 'r':
      case 'R':
        this.dashboard.refreshDashboard();
        break;
        
      case 'p':
      case 'P':
        this.dashboard.showPluginStatus();
        break;
        
      case 'm':
      case 'M':
        this.dashboard.showMemoryStats();
        break;
        
      case 't':
      case 'T':
        this.dashboard.showTaskStatus();
        break;
        
      case 'c':
      case 'C':
        // Toggle compact layout
        const currentConfig = this.dashboard.getConfig();
        const newLayout = currentConfig.layout === 'compact' ? 'spacious' : 'compact';
        this.dashboard.updateConfig({ layout: newLayout });
        break;
        
      case 'a':
      case 'A':
        // Toggle animations
        const config = this.dashboard.getConfig();
        this.dashboard.updateConfig({ showAnimations: !config.showAnimations });
        break;
        
      case 'h':
      case 'H':
        this.showHelp();
        break;
    }
  }

  private setupKeyHandlers(): void {
    const readline = require('readline');
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    
    // Remove any prior listener owned by this instance to prevent accumulation
    if (this.keypressListener) {
      process.stdin.removeListener('keypress', this.keypressListener);
    }
    this.keypressListener = (_str: string, key: any) => {
      if (key && key.name) {
        this.keyHandler(key.name);
      }
    };
    process.stdin.on('keypress', this.keypressListener);
  }

  private showHelp(): void {
    console.clear();
    console.log(TerminalUtils.renderHeader('🐟 AZERCLAW Dashboard Help', 60));
    
    const helpTable = {
      headers: ['Key', 'Action'],
      rows: [
        ['Q', 'Quit dashboard'],
        ['R', 'Refresh dashboard'],
        ['P', 'Show plugin status'],
        ['M', 'Show memory statistics'],
        ['T', 'Show task status'],
        ['C', 'Toggle compact layout'],
        ['A', 'Toggle animations'],
        ['H', 'Show this help']
      ],
      alignments: ['left' as const, 'left' as const]
    };
    
    console.log(TerminalTables.renderTable(helpTable, 60));
    console.log();
    console.log(chalk.dim('Press any key to return to dashboard...'));
    
    // Wait for any key to return
    process.stdin.once('keypress', () => {
      this.dashboard.refreshDashboard();
    });
  }

  cleanup(): void {
    process.stdin.setRawMode(false);
    if (this.keypressListener) {
      process.stdin.removeListener('keypress', this.keypressListener);
      this.keypressListener = null;
    }
  }
}

// ─── Dashboard Factory ─────────────────────────────────────────────────

export async function createDashboard(config?: Partial<DashboardConfig>): Promise<TerminalDashboard> {
  const dashboard = new TerminalDashboard(config);
  return dashboard;
}

export async function runInteractiveDashboard(config?: Partial<DashboardConfig>): Promise<void> {
  const dashboard = await createDashboard(config);
  const controls = new DashboardControls(dashboard);
  
  try {
    await dashboard.start();
  } catch (error) {
    console.error('Dashboard error:', error);
  } finally {
    controls.cleanup();
    dashboard.stop();
  }
}
