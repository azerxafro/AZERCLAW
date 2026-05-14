/**
 * 🐟 AZERCLAW Terminal Interface
 * Enhanced terminal interface with rich visualizations and interactive elements
 */

export * from './visualizations';
export * from './dashboard';

import { TerminalDashboard, createDashboard, runInteractiveDashboard } from './dashboard';
import { TerminalCharts, TerminalProgress, TerminalCards, TerminalTables, TerminalAnimations, TerminalUtils } from './visualizations';

// ─── Terminal Interface Manager ─────────────────────────────────────────

export interface TerminalConfig {
  dashboard: {
    enabled: boolean;
    refreshInterval: number;
    autoRefresh: boolean;
    showAnimations: boolean;
    layout: 'compact' | 'spacious' | 'minimal';
  };
  visualizations: {
    colorScheme: 'default' | 'dark' | 'light';
    maxWidth: number;
    showBorders: boolean;
  };
}

export class TerminalInterfaceManager {
  private config: TerminalConfig;
  private dashboard: TerminalDashboard | null = null;

  constructor(config: Partial<TerminalConfig> = {}) {
    this.config = {
      dashboard: {
        enabled: true,
        refreshInterval: 5,
        autoRefresh: true,
        showAnimations: true,
        layout: 'spacious'
      },
      visualizations: {
        colorScheme: 'default',
        maxWidth: 80,
        showBorders: true
      },
      ...config
    };
  }

  // ─── Dashboard Management ─────────────────────────────────────────────

  async startDashboard(): Promise<TerminalDashboard> {
    if (this.dashboard) {
      return this.dashboard;
    }

    this.dashboard = await createDashboard(this.config.dashboard);
    await this.dashboard.start();
    
    return this.dashboard;
  }

  stopDashboard(): void {
    if (this.dashboard) {
      this.dashboard.stop();
      this.dashboard = null;
    }
  }

  getDashboard(): TerminalDashboard | null {
    return this.dashboard;
  }

  // ─── Quick Visualization Methods ─────────────────────────────────────

  renderQuickChart(data: any, type: 'bar' | 'line' | 'pie' = 'bar'): string {
    switch (type) {
      case 'line':
        return TerminalCharts.renderLineChart(data);
      case 'pie':
        return TerminalCharts.renderPieChart(data);
      case 'bar':
      default:
        return TerminalCharts.renderBarChart(data);
    }
  }

  renderQuickProgress(current: number, total: number, label?: string): string {
    return TerminalProgress.renderProgressBar({ current, total, label });
  }

  renderQuickTable(headers: string[], rows: string[][]): string {
    return TerminalTables.renderTable({ headers, rows });
  }

  renderQuickCards(cards: any[]): string {
    return TerminalCards.renderDashboard(cards);
  }

  // ─── Utility Methods ─────────────────────────────────────────────────

  formatHeader(title: string): string {
    return TerminalUtils.renderHeader(title, this.config.visualizations.maxWidth);
  }

  formatSeparator(char?: string): string {
    return TerminalUtils.renderSeparator(char, this.config.visualizations.maxWidth);
  }

  formatBox(content: string, title?: string): string {
    return TerminalUtils.renderBox(content, title, this.config.visualizations.maxWidth);
  }

  colorizeValue(value: number, good: number, warning: number): string {
    return TerminalUtils.colorizeNumber(value, { good, warning });
  }

  // ─── Configuration ─────────────────────────────────────────────────

  getConfig(): TerminalConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<TerminalConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.dashboard && newConfig.dashboard) {
      this.dashboard.updateConfig(newConfig.dashboard);
    }
  }

  // ─── Cleanup ─────────────────────────────────────────────────────

  cleanup(): void {
    this.stopDashboard();
  }
}

// ─── Global Terminal Interface Manager ─────────────────────────────────

let terminalInterfaceManager: TerminalInterfaceManager | null = null;

export function getTerminalInterfaceManager(config?: Partial<TerminalConfig>): TerminalInterfaceManager {
  if (!terminalInterfaceManager) {
    terminalInterfaceManager = new TerminalInterfaceManager(config);
  }
  return terminalInterfaceManager;
}

export async function initializeTerminalInterface(config?: Partial<TerminalConfig>): Promise<TerminalInterfaceManager> {
  const manager = getTerminalInterfaceManager(config);
  
  if (config?.dashboard?.enabled) {
    await manager.startDashboard();
  }
  
  return manager;
}

export function shutdownTerminalInterface(): void {
  if (terminalInterfaceManager) {
    terminalInterfaceManager.cleanup();
    terminalInterfaceManager = null;
  }
}

// ─── Convenience Functions ─────────────────────────────────────────────

export async function showDashboard(config?: Partial<TerminalConfig>): Promise<void> {
  await runInteractiveDashboard(config?.dashboard);
}

export function showQuickStats(): void {
  const manager = getTerminalInterfaceManager();
  
  // Quick stats display
  console.log(manager.formatHeader('🐟 AZERCLAW Quick Stats'));
  
  const statsCards = [
    {
      title: 'Status',
      value: 'Running',
      icon: '🟢',
      color: 'green'
    },
    {
      title: 'Mode',
      value: 'Terminal',
      icon: '💻',
      color: 'blue'
    },
    {
      title: 'Version',
      value: '2.2.0',
      icon: '🏷️',
      color: 'magenta'
    }
  ];
  
  console.log(manager.renderQuickCards(statsCards));
  console.log(manager.formatSeparator());
}
