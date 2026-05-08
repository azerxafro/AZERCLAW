/**
 * 🐟 AZERCLAW Fish Animations
 * Replaces OpenClaw's lobster with an animated fish mascot.
 * Includes: splash screen, thinking animation, progress, success/error states.
 */

const chalk = require('chalk');
const gradientString = require('gradient-string');

// ─── Color Palette ──────────────────────────────────────────────
const OCEAN_GRADIENT = gradientString(['#0ea5e9', '#06b6d4', '#14b8a6', '#10b981']);
const GOLD_GRADIENT = gradientString(['#f59e0b', '#f97316', '#ef4444']);
const NEON_GRADIENT = gradientString(['#a855f7', '#6366f1', '#3b82f6', '#06b6d4']);
const LUXE_GRADIENT = gradientString(['#c084fc', '#818cf8', '#60a5fa', '#34d399']);
const EMBER_GRADIENT = gradientString(['#fbbf24', '#f59e0b', '#ef4444', '#dc2626']);

// ─── Fish ASCII Art ─────────────────────────────────────────────

export const FISH_FRAMES = [
  `      ><(((º>`,
  `       ><(((º>`,
  `        ><(((º>`,
  `         ><(((º>`,
  `        ><(((º>`,
  `       ><(((º>`,
];

export const FISH_SWIM_FRAMES = [
  `  ~~ ><(((º>  ~~`,
  ` ~~  ><(((º> ~~`,
  `~~   ><(((º>~~`,
  ` ~~  ><(((º> ~~`,
];

export const FISH_DEAD = `  ><(((x>`;
export const FISH_HAPPY = `  ><(((°>  ✨`;

export const BIG_FISH = [
  `           ╭────────────╮`,
  `    ╱╲    ╱              ╲`,
  `   ╱  ╲──╱    ●           ╲`,
  `  ╱    ╲╱                  ╲───╮`,
  `  ╲    ╱╲                  ╱───╯`,
  `   ╲  ╱──╲               ╱`,
  `    ╲╱    ╲              ╱`,
  `           ╰────────────╯`,
];

// ─── Premium Splash Screen (Copilot-style) ─────────────────────

const SPLASH_LOGO = [
  `                                                                        `,
  `     █████╗ ███████╗███████╗██████╗  ██████╗██╗      █████╗ ██╗    ██╗  `,
  `    ██╔══██╗╚══███╔╝██╔════╝██╔══██╗██╔════╝██║     ██╔══██╗██║    ██║  `,
  `    ███████║  ███╔╝ █████╗  ██████╔╝██║     ██║     ███████║██║ █╗ ██║  `,
  `    ██╔══██║ ███╔╝  ██╔══╝  ██╔══██╗██║     ██║     ██╔══██║██║███╗██║  `,
  `    ██║  ██║███████╗███████╗██║  ██║╚██████╗███████╗██║  ██║╚███╔███╔╝  `,
  `    ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝   `,
  `                                                                        `,
];

const SPLASH_FISH_ART = [
  `                     ·  .  ·                    `,
  `                  ·  . 🫧 .  ·                  `,
  `               ·  .  ·  .  ·  .  ·              `,
  `                                                `,
  `              ╱╲                                 `,
  `             ╱  ╲──╮     ●                       `,
  `            ╱    ╲  ╲─────────────╮              `,
  `            ╲    ╱  ╱─────────────╯              `,
  `             ╲  ╱──╯                             `,
  `              ╲╱                                 `,
  `                                                `,
  `           ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~       `,
];

const TAGLINE = `Your AI · Your Keys · Your Way`;
const SUBTITLE = `Free & Open Source AI Agent — BYOK`;

// ─── Animated Splash ────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function clearLines(count: number): void {
  for (let i = 0; i < count; i++) {
    process.stdout.write('\x1b[1A\x1b[2K');
  }
}

function hideCursor(): void {
  process.stdout.write('\x1b[?25l');
}

function showCursor(): void {
  process.stdout.write('\x1b[?25h');
}

export async function playSplashScreen(version: string): Promise<void> {
  hideCursor();
  
  const termWidth = process.stdout.columns || 80;
  
  // Phase 1: Fade in logo letter by letter
  console.log('');
  
  for (let row = 0; row < SPLASH_LOGO.length; row++) {
    const line = SPLASH_LOGO[row];
    const pad = Math.max(0, Math.floor((termWidth - line.length) / 2));
    const paddedLine = ' '.repeat(pad) + line;
    process.stdout.write(NEON_GRADIENT(paddedLine) + '\n');
    await sleep(40);
  }
  
  // Phase 2: Draw fish art
  await sleep(150);
  
  for (let row = 0; row < SPLASH_FISH_ART.length; row++) {
    const line = SPLASH_FISH_ART[row];
    const pad = Math.max(0, Math.floor((termWidth - line.length) / 2));
    const paddedLine = ' '.repeat(pad) + line;
    process.stdout.write(OCEAN_GRADIENT(paddedLine) + '\n');
    await sleep(30);
  }
  
  // Phase 3: Tagline with typing effect
  await sleep(200);
  const tagPad = Math.max(0, Math.floor((termWidth - TAGLINE.length) / 2));
  process.stdout.write(' '.repeat(tagPad));
  
  for (const char of TAGLINE) {
    process.stdout.write(LUXE_GRADIENT(char));
    await sleep(20);
  }
  process.stdout.write('\n');
  
  // Phase 4: Subtitle
  await sleep(100);
  const subPad = Math.max(0, Math.floor((termWidth - SUBTITLE.length) / 2));
  const styledSub = chalk.dim(SUBTITLE);
  console.log(' '.repeat(subPad) + styledSub);
  
  // Phase 5: Version badge
  await sleep(100);
  const versionStr = `v${version}`;
  const vPad = Math.max(0, Math.floor((termWidth - versionStr.length - 4) / 2));
  console.log(' '.repeat(vPad) + chalk.bgHex('#1e1b4b').hex('#818cf8')(` ${versionStr} `) + '\n');
  
  // Phase 6: Separator line animation
  const sepChar = '─';
  const sepLen = Math.min(60, termWidth - 10);
  const sepPad = Math.max(0, Math.floor((termWidth - sepLen) / 2));
  process.stdout.write(' '.repeat(sepPad));
  
  for (let i = 0; i < sepLen; i++) {
    const progress = i / sepLen;
    const hue = Math.floor(200 + progress * 160) % 360;
    process.stdout.write(chalk.hsl(hue, 80, 60)(sepChar));
    if (i % 4 === 0) await sleep(5);
  }
  process.stdout.write('\n\n');
  
  showCursor();
}

// ─── Quick Splash (for subsequent runs) ─────────────────────────

export function printQuickSplash(version: string): void {
  const termWidth = process.stdout.columns || 80;
  const fishLine = `  ><(((º>  AZERCLAW v${version}`;
  const pad = Math.max(0, Math.floor((termWidth - fishLine.length) / 2));
  console.log('');
  console.log(' '.repeat(pad) + OCEAN_GRADIENT(fishLine));
  console.log(' '.repeat(pad) + chalk.dim(`  Your AI · Your Keys · Your Way`));
  console.log('');
}

// ─── Thinking Animation ─────────────────────────────────────────

export class FishThinkingAnimation {
  private interval: NodeJS.Timeout | null = null;
  private frameIndex = 0;
  private message: string;
  private bubbleFrames = ['○', '◦', '·', '◦'];
  private bubbleIndex = 0;

  constructor(message: string = 'Thinking') {
    this.message = message;
  }

  start(): void {
    hideCursor();
    this.frameIndex = 0;
    this.bubbleIndex = 0;
    
    this.interval = setInterval(() => {
      const fish = FISH_FRAMES[this.frameIndex % FISH_FRAMES.length];
      const bubble = this.bubbleFrames[this.bubbleIndex % this.bubbleFrames.length];
      const dots = '.'.repeat((this.frameIndex % 3) + 1).padEnd(3);
      
      process.stdout.write('\r\x1b[2K');
      process.stdout.write(
        OCEAN_GRADIENT(fish) + 
        chalk.hex('#60a5fa')(` ${bubble} ${bubble} `) + 
        chalk.hex('#a78bfa')(`${this.message}${dots}`)
      );
      
      this.frameIndex++;
      this.bubbleIndex++;
    }, 150);
  }

  updateMessage(message: string): void {
    this.message = message;
  }

  stop(finalMessage?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    process.stdout.write('\r\x1b[2K');
    if (finalMessage) {
      process.stdout.write(
        OCEAN_GRADIENT(`  ><(((°>`) + 
        chalk.hex('#34d399')(` ✓ ${finalMessage}`) + '\n'
      );
    }
    showCursor();
  }

  fail(errorMessage?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    process.stdout.write('\r\x1b[2K');
    if (errorMessage) {
      process.stdout.write(
        EMBER_GRADIENT(`  ><(((x>`) + 
        chalk.hex('#f87171')(` ✗ ${errorMessage}`) + '\n'
      );
    }
    showCursor();
  }
}

// ─── Progress Bar with Swimming Fish ─────────────────────────────

export function renderFishProgress(current: number, total: number, label: string = ''): void {
  const termWidth = process.stdout.columns || 80;
  const barWidth = Math.min(40, termWidth - 30);
  const progress = Math.min(1, current / total);
  const filled = Math.round(barWidth * progress);
  const empty = barWidth - filled;
  const percent = Math.round(progress * 100);
  
  const fishPos = Math.round(filled);
  const bar = 
    chalk.hex('#06b6d4')('═'.repeat(Math.max(0, fishPos - 1))) +
    OCEAN_GRADIENT('><(((º>') +
    chalk.hex('#1e3a5f')('░'.repeat(Math.max(0, empty)));
  
  const percentStr = chalk.hex('#818cf8')(`${percent}%`);
  const labelStr = label ? chalk.dim(` ${label}`) : '';
  
  process.stdout.write(`\r\x1b[2K  ${bar} ${percentStr}${labelStr}`);
  
  if (current >= total) {
    process.stdout.write('\n');
  }
}

// ─── Status Indicators ──────────────────────────────────────────

export function fishSuccess(message: string): void {
  console.log(OCEAN_GRADIENT(`  ><(((°>`) + chalk.hex('#34d399')(` ✓ ${message}`));
}

export function fishError(message: string): void {
  console.log(EMBER_GRADIENT(`  ><(((x>`) + chalk.hex('#f87171')(` ✗ ${message}`));
}

export function fishInfo(message: string): void {
  console.log(OCEAN_GRADIENT(`  ><(((º>`) + chalk.hex('#60a5fa')(` ℹ ${message}`));
}

export function fishWarn(message: string): void {
  console.log(GOLD_GRADIENT(`  ><(((º>`) + chalk.hex('#fbbf24')(` ⚠ ${message}`));
}

// ─── Decorative Box ──────────────────────────────────────────────

export function fishBox(title: string, content: string[], options: { width?: number } = {}): void {
  const width = options.width || Math.min(60, (process.stdout.columns || 80) - 4);
  const innerWidth = width - 4;
  
  const topBorder = chalk.hex('#6366f1')(`  ╭${'─'.repeat(width - 2)}╮`);
  const bottomBorder = chalk.hex('#6366f1')(`  ╰${'─'.repeat(width - 2)}╯`);
  
  console.log(topBorder);
  
  // Title
  const titlePad = Math.max(0, innerWidth - title.length);
  const leftPad = Math.floor(titlePad / 2);
  const rightPad = titlePad - leftPad;
  console.log(
    chalk.hex('#6366f1')('  │') + 
    ' '.repeat(leftPad + 1) + 
    LUXE_GRADIENT(title) + 
    ' '.repeat(rightPad + 1) + 
    chalk.hex('#6366f1')('│')
  );
  
  // Separator
  console.log(chalk.hex('#6366f1')(`  │${'─'.repeat(width - 2)}│`));
  
  // Content
  for (const line of content) {
    const stripped = line.replace(/\x1b\[[0-9;]*m/g, '');
    const linePad = Math.max(0, innerWidth - stripped.length);
    console.log(
      chalk.hex('#6366f1')('  │ ') + 
      line + 
      ' '.repeat(linePad + 1) + 
      chalk.hex('#6366f1')('│')
    );
  }
  
  console.log(bottomBorder);
}

// ─── Exports ────────────────────────────────────────────────────

module.exports = {
  FISH_FRAMES,
  FISH_SWIM_FRAMES,
  FISH_DEAD,
  FISH_HAPPY,
  BIG_FISH,
  playSplashScreen,
  printQuickSplash,
  FishThinkingAnimation,
  renderFishProgress,
  fishSuccess,
  fishError,
  fishInfo,
  fishWarn,
  fishBox,
  OCEAN_GRADIENT,
  GOLD_GRADIENT,
  NEON_GRADIENT,
  LUXE_GRADIENT,
  EMBER_GRADIENT,
};
