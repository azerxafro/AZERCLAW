/**
 * 🐟 AZERCLAW Terminal Visualizations
 * Rich terminal visualizations using ASCII/Unicode art and colors
 */

import * as chalk from 'chalk';
// Note: blessed and blessed-contrib are optional dependencies
// import { Box, Text, useInput } from 'blessed';
// import { Widget } from 'blessed-contrib';

// ─── Visualization Types ───────────────────────────────────────────────

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    color?: string;
  }>;
}

export interface ProgressData {
  current: number;
  total: number;
  label?: string;
  color?: string;
}

export interface MetricCard {
  title: string;
  value: string | number;
  change?: number;
  unit?: string;
  color?: string;
  icon?: string;
}

export interface TableData {
  headers: string[];
  rows: string[][];
  alignments?: ('left' | 'center' | 'right')[];
}

// ─── Terminal Canvas Implementation ─────────────────────────────────────

export class TerminalCanvas {
  private width: number;
  private height: number;
  private buffer: string[][];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.buffer = Array(height).fill(null).map(() => Array(width).fill(' '));
  }

  clear(): void {
    this.buffer = Array(this.height).fill(null).map(() => Array(this.width).fill(' '));
  }

  setPixel(x: number, y: number, char: string, color?: string): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.buffer[y][x] = color && color in chalk ? (chalk as any)[color](char) : char;
    }
  }

  drawLine(x1: number, y1: number, x2: number, y2: number, char: string = '─', color?: string): void {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;

    let x = x1;
    let y = y1;

    while (true) {
      this.setPixel(x, y, char, color);

      if (x === x2 && y === y2) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  drawBox(x: number, y: number, width: number, height: number, color?: string): void {
    // Draw corners
    this.setPixel(x, y, '┌', color);
    this.setPixel(x + width - 1, y, '┐', color);
    this.setPixel(x, y + height - 1, '└', color);
    this.setPixel(x + width - 1, y + height - 1, '┘', color);

    // Draw edges
    for (let i = 1; i < width - 1; i++) {
      this.setPixel(x + i, y, '─', color);
      this.setPixel(x + i, y + height - 1, '─', color);
    }

    for (let i = 1; i < height - 1; i++) {
      this.setPixel(x, y + i, '│', color);
      this.setPixel(x + width - 1, y + i, '│', color);
    }
  }

  drawText(x: number, y: number, text: string, color?: string): void {
    for (let i = 0; i < text.length && x + i < this.width; i++) {
      this.setPixel(x + i, y, text[i], color);
    }
  }

  render(): string {
    return this.buffer.map(row => row.join('')).join('\n');
  }
}

// ─── Chart Visualizations ───────────────────────────────────────────────

export class TerminalCharts {
  static renderBarChart(data: ChartData, width: number = 50, height: number = 10): string {
    const canvas = new TerminalCanvas(width, height);
    
    if (data.labels.length === 0 || data.datasets.length === 0) {
      canvas.drawText(1, 1, 'No data available', 'gray');
      return canvas.render();
    }

    const dataset = data.datasets[0]; // Use first dataset
    const maxValue = Math.max(...dataset.data);
    const barWidth = Math.floor((width - 10) / data.labels.length);
    const chartHeight = height - 3;

    // Draw chart border
    canvas.drawBox(0, 0, width, height, 'cyan');

    // Draw bars
    data.labels.forEach((label, index) => {
      const value = dataset.data[index];
      const barHeight = Math.round((value / maxValue) * chartHeight);
      const x = 2 + index * (barWidth + 1);
      
      // Draw bar
      for (let i = 0; i < barHeight; i++) {
        const y = height - 2 - i;
        for (let j = 0; j < barWidth; j++) {
          canvas.setPixel(x + j, y, '█', dataset.color || 'green');
        }
      }

      // Draw label
      if (label.length <= barWidth) {
        canvas.drawText(x + Math.floor((barWidth - label.length) / 2), height - 1, label, 'white');
      } else {
        canvas.drawText(x, height - 1, label.substring(0, barWidth), 'white');
      }

      // Draw value
      const valueStr = value.toString();
      canvas.drawText(x + Math.floor((barWidth - valueStr.length) / 2), height - 2 - barHeight, valueStr, 'yellow');
    });

    // Draw title
    if (dataset.label) {
      canvas.drawText(Math.floor((width - dataset.label.length) / 2), 0, dataset.label, 'cyan');
    }

    return canvas.render();
  }

  static renderLineChart(data: ChartData, width: number = 60, height: number = 15): string {
    const canvas = new TerminalCanvas(width, height);
    
    if (data.labels.length === 0 || data.datasets.length === 0) {
      canvas.drawText(1, 1, 'No data available', 'gray');
      return canvas.render();
    }

    const chartWidth = width - 10;
    const chartHeight = height - 4;
    
    // Find max value across all datasets
    const maxValue = Math.max(...data.datasets.flatMap(d => d.data));
    
    // Draw chart border
    canvas.drawBox(0, 0, width, height, 'cyan');

    // Draw grid lines
    for (let i = 0; i <= 4; i++) {
      const y = 1 + Math.floor(i * chartHeight / 4);
      for (let x = 1; x < width - 1; x++) {
        canvas.setPixel(x, y, '·', 'gray');
      }
    }

    // Draw datasets
    data.datasets.forEach(dataset => {
      const points: Array<{x: number, y: number}> = [];
      
      dataset.data.forEach((value, index) => {
        const x = 2 + Math.floor(index * chartWidth / (data.labels.length - 1));
        const y = 1 + chartHeight - Math.floor((value / maxValue) * chartHeight);
        points.push({x, y});
      });

      // Draw line
      for (let i = 0; i < points.length - 1; i++) {
        canvas.drawLine(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, '─', dataset.color || 'green');
      }

      // Draw points
      points.forEach(point => {
        canvas.setPixel(point.x, point.y, '●', dataset.color || 'green');
      });
    });

    // Draw title
    if (data.datasets[0].label) {
      canvas.drawText(Math.floor((width - data.datasets[0].label.length) / 2), 0, data.datasets[0].label, 'cyan');
    }

    return canvas.render();
  }

  static renderPieChart(data: ChartData, width: number = 30, height: number = 15): string {
    const canvas = new TerminalCanvas(width, height);
    
    if (data.labels.length === 0 || data.datasets.length === 0) {
      canvas.drawText(1, 1, 'No data available', 'gray');
      return canvas.render();
    }

    const dataset = data.datasets[0];
    const total = dataset.data.reduce((sum, value) => sum + value, 0);
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const radius = Math.min(width, height) / 3;

    // Draw pie slices
    let currentAngle = 0;
    const colors = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];
    
    dataset.data.forEach((value, index) => {
      const percentage = value / total;
      const angle = percentage * 2 * Math.PI;
      
      // Draw slice (simplified - using characters)
      const sliceChar = ['◐', '◑', '◒', '◓'][index % 4];
      const color = colors[index % colors.length];
      
      for (let r = 0; r < radius; r++) {
        for (let a = 0; a < angle; a += 0.1) {
          const x = Math.round(centerX + r * Math.cos(currentAngle + a));
          const y = Math.round(centerY + r * Math.sin(currentAngle + a));
          
          if (x >= 0 && x < width && y >= 0 && y < height) {
            canvas.setPixel(x, y, sliceChar, color);
          }
        }
      }
      
      currentAngle += angle;
    });

    // Draw legend
    let legendY = 1;
    data.labels.forEach((label, index) => {
      const value = dataset.data[index];
      const percentage = ((value / total) * 100).toFixed(1);
      const color = colors[index % colors.length];
      
      canvas.drawText(width - 15, legendY, '●', color);
      canvas.drawText(width - 13, legendY, `${label}: ${percentage}%`, 'white');
      legendY++;
    });

    return canvas.render();
  }
}

// ─── Progress Indicators ───────────────────────────────────────────────

export class TerminalProgress {
  static renderProgressBar(progress: ProgressData, width: number = 40): string {
    const percentage = Math.min(100, Math.max(0, (progress.current / progress.total) * 100));
    const filled = Math.round((width - 2) * (percentage / 100));
    const empty = (width - 2) - filled;
    
    const filledBar = '█'.repeat(filled);
    const emptyBar = '░'.repeat(empty);
    const color = progress.color || 'green';
    
    let progressBar = color in chalk ? (chalk as any)[color](`[${filledBar}${emptyBar}]`) : chalk.green(`[${filledBar}${emptyBar}]`);
    
    if (progress.label) {
      progressBar += ` ${progress.label}`;
    }
    
    progressBar += ` ${percentage.toFixed(1)}%`;
    
    return progressBar;
  }

  static renderSpinner(frame: number, label?: string): string {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    const spinner = frames[frame % frames.length];
    
    let output = chalk.cyan(spinner);
    if (label) {
      output += ` ${label}`;
    }
    
    return output;
  }

  static renderLoadingBar(message: string, width: number = 50): string {
    const time = Date.now() / 1000;
    const position = Math.floor((Math.sin(time) + 1) * (width - message.length - 4) / 2);
    
    const before = ' '.repeat(position);
    const after = ' '.repeat(width - message.length - 4 - position);
    
    return chalk.blue(`[ ${before}${chalk.white(message)}${after} ]`);
  }
}

// ─── Metric Cards ─────────────────────────────────────────────────────

export class TerminalCards {
  static renderMetricCard(card: MetricCard, width: number = 20): string {
    const canvas = new TerminalCanvas(width, 6);
    
    // Draw border
    canvas.drawBox(0, 0, width, 6, card.color || 'blue');
    
    // Draw icon
    if (card.icon) {
      canvas.drawText(1, 1, card.icon, card.color || 'blue');
    }
    
    // Draw title
    const title = card.title.length > width - 4 ? card.title.substring(0, width - 6) + '..' : card.title;
    canvas.drawText(1, 2, title, 'white');
    
    // Draw value
    const valueStr = card.value.toString();
    const valueX = Math.floor((width - valueStr.length) / 2);
    canvas.drawText(valueX, 3, valueStr, card.color || 'blue');
    
    // Draw change indicator
    if (card.change !== undefined) {
      const changeStr = card.change >= 0 ? `↑${card.change}` : `↓${Math.abs(card.change)}`;
      const changeColor = card.change >= 0 ? 'green' : 'red';
      canvas.drawText(1, 4, changeStr, changeColor);
    }
    
    // Draw unit
    if (card.unit) {
      canvas.drawText(width - card.unit.length - 1, 4, card.unit, 'gray');
    }
    
    return canvas.render();
  }

  static renderDashboard(cards: MetricCard[], columns: number = 3): string {
    const cardWidth = 25;
    const cardHeight = 6;
    const padding = 1;
    
    const rows = Math.ceil(cards.length / columns);
    const totalHeight = rows * (cardHeight + padding) - padding;
    const totalWidth = columns * (cardWidth + padding) - padding;
    
    const canvas = new TerminalCanvas(totalWidth, totalHeight);
    
    cards.forEach((card, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      
      const x = col * (cardWidth + padding);
      const y = row * (cardHeight + padding);
      
      const cardCanvas = new TerminalCanvas(cardWidth, cardHeight);
      const cardRender = this.renderMetricCard(card, cardWidth);
      
      // Draw card on main canvas
      const lines = cardRender.split('\n');
      lines.forEach((line, lineIndex) => {
        for (let i = 0; i < line.length; i++) {
          canvas.setPixel(x + i, y + lineIndex, line[i]);
        }
      });
    });
    
    return canvas.render();
  }
}

// ─── Table Rendering ─────────────────────────────────────────────────

export class TerminalTables {
  static renderTable(data: TableData, width: number = 80): string {
    if (data.headers.length === 0 || data.rows.length === 0) {
      return chalk.gray('No data to display');
    }

    // Calculate column widths
    const columnCount = data.headers.length;
    const columnWidths: number[] = [];
    
    // Initialize with header widths
    for (let i = 0; i < columnCount; i++) {
      columnWidths[i] = data.headers[i].length;
    }
    
    // Adjust for row content
    for (const row of data.rows) {
      for (let i = 0; i < Math.min(columnCount, row.length); i++) {
        columnWidths[i] = Math.max(columnWidths[i], row[i].length);
      }
    }
    
    // Limit column widths to fit total width
    const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0) + (columnCount - 1) * 3; // +3 for separators
    if (totalWidth > width) {
      const scale = (width - (columnCount - 1) * 3) / columnWidths.reduce((sum, width) => sum + width, 0);
      for (let i = 0; i < columnWidths.length; i++) {
        columnWidths[i] = Math.floor(columnWidths[i] * scale);
        columnWidths[i] = Math.max(columnWidths[i], 3); // Minimum width
      }
    }
    
    let output = '';
    
    // Render header
    output += chalk.cyan('┌');
    for (let i = 0; i < columnCount; i++) {
      output += '─'.repeat(columnWidths[i] + 2);
      if (i < columnCount - 1) output += '┬';
    }
    output += '┐\n';
    
    output += chalk.cyan('│');
    for (let i = 0; i < columnCount; i++) {
      const header = data.headers[i];
      const alignment = data.alignments?.[i] || 'left';
      const paddedHeader = this.padString(header, columnWidths[i], alignment);
      output += ` ${chalk.bold(paddedHeader)} `;
      output += chalk.cyan('│');
    }
    output += '\n';
    
    output += chalk.cyan('├');
    for (let i = 0; i < columnCount; i++) {
      output += '─'.repeat(columnWidths[i] + 2);
      if (i < columnCount - 1) output += '┼';
    }
    output += '┤\n';
    
    // Render rows
    for (const row of data.rows) {
      output += chalk.cyan('│');
      for (let i = 0; i < columnCount; i++) {
        const cell = row[i] || '';
        const alignment = data.alignments?.[i] || 'left';
        const paddedCell = this.padString(cell, columnWidths[i], alignment);
        output += ` ${paddedCell} `;
        output += chalk.cyan('│');
      }
      output += '\n';
    }
    
    // Render bottom border
    output += chalk.cyan('└');
    for (let i = 0; i < columnCount; i++) {
      output += '─'.repeat(columnWidths[i] + 2);
      if (i < columnCount - 1) output += '┴';
    }
    output += '┘';
    
    return output;
  }

  private static padString(str: string, width: number, alignment: 'left' | 'center' | 'right'): string {
    if (str.length >= width) {
      return str.substring(0, width - 3) + '...';
    }
    
    const padding = width - str.length;
    
    switch (alignment) {
      case 'center':
        const leftPad = Math.floor(padding / 2);
        const rightPad = padding - leftPad;
        return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
      case 'right':
        return ' '.repeat(padding) + str;
      case 'left':
      default:
        return str + ' '.repeat(padding);
    }
  }
}

// ─── Animated Visualizations ───────────────────────────────────────────

export class TerminalAnimations {
  static renderWave(time: number, width: number = 50, height: number = 10): string {
    const canvas = new TerminalCanvas(width, height);
    
    for (let x = 0; x < width; x++) {
      const y = Math.floor(height / 2 + Math.sin((x / width) * Math.PI * 4 + time) * (height / 3));
      canvas.setPixel(x, y, '∿', 'cyan');
    }
    
    return canvas.render();
  }

  static renderPulse(time: number, width: number = 20, height: number = 10): string {
    const canvas = new TerminalCanvas(width, height);
    
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const radius = Math.abs(Math.sin(time)) * Math.min(width, height) / 3;
    
    for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
      const x = Math.round(centerX + radius * Math.cos(angle));
      const y = Math.round(centerY + radius * Math.sin(angle));
      
      if (x >= 0 && x < width && y >= 0 && y < height) {
        canvas.setPixel(x, y, '●', 'magenta');
      }
    }
    
    return canvas.render();
  }

  static renderMatrixRain(time: number, width: number = 40, height: number = 15): string {
    const canvas = new TerminalCanvas(width, height);
    
    // Simple matrix rain effect
    for (let x = 0; x < width; x += 2) {
      const seed = (x * 1000 + time * 100) % 1000;
      const y = Math.floor((seed / 1000) * height);
      
      for (let i = 0; i < 5; i++) {
        const currentY = (y - i + height) % height;
        const brightness = 1 - (i / 5);
        const char = i === 0 ? '█' : '▓';
        const color = brightness > 0.7 ? 'green' : brightness > 0.3 ? 'white' : 'gray';
        
        canvas.setPixel(x, currentY, char, color);
      }
    }
    
    return canvas.render();
  }
}

// ─── Utility Functions ─────────────────────────────────────────────────

export class TerminalUtils {
  static renderHeader(title: string, width: number = 80): string {
    const titleWithPadding = ` ${title} `;
    const padding = Math.max(0, width - titleWithPadding.length - 4);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    
    const line = '═'.repeat(width);
    const titleLine = `║${' '.repeat(leftPad)}${chalk.bold(title)}${' '.repeat(rightPad)}║`;
    
    return chalk.cyan(line) + '\n' + chalk.cyan(titleLine) + '\n' + chalk.cyan(line);
  }

  static renderSeparator(char: string = '─', width: number = 80): string {
    return chalk.gray(char.repeat(width));
  }

  static renderBox(content: string, title?: string, width: number = 80): string {
    const lines = content.split('\n');
    const maxContentWidth = Math.max(...lines.map(line => line.length));
    const boxWidth = Math.max(width, maxContentWidth + 4);
    
    let output = '';
    
    // Top border
    output += chalk.cyan('┌' + '─'.repeat(boxWidth - 2) + '┐') + '\n';
    
    // Title
    if (title) {
      const titlePadding = boxWidth - title.length - 4;
      const leftTitlePad = Math.floor(titlePadding / 2);
      const rightTitlePad = titlePadding - leftTitlePad;
      output += chalk.cyan('│') + ' '.repeat(leftTitlePad) + chalk.bold(title) + ' '.repeat(rightTitlePad) + chalk.cyan('│') + '\n';
      output += chalk.cyan('├' + '─'.repeat(boxWidth - 2) + '┤') + '\n';
    }
    
    // Content
    for (const line of lines) {
      const paddedLine = line.padEnd(boxWidth - 2);
      output += chalk.cyan('│') + paddedLine + chalk.cyan('│') + '\n';
    }
    
    // Bottom border
    output += chalk.cyan('└' + '─'.repeat(boxWidth - 2) + '┘');
    
    return output;
  }

  static colorizeNumber(value: number, thresholds: {good: number, warning: number}): string {
    if (value >= thresholds.good) {
      return chalk.green(value.toString());
    } else if (value >= thresholds.warning) {
      return chalk.yellow(value.toString());
    } else {
      return chalk.red(value.toString());
    }
  }

  static formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  static formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else if (ms < 3600000) {
      return `${(ms / 60000).toFixed(1)}m`;
    } else {
      return `${(ms / 3600000).toFixed(1)}h`;
    }
  }
}
