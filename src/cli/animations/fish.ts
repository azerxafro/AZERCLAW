/**
 * 🐟 AZERCLAW Fish Animations — THE BOYS EDITION
 * Diabolical, gritty, and uncensored.
 */

const chalk = require('chalk');
const gradientString = require('gradient-string');

// Helper to create TTY-aware gradients
const createGradient = (colors: string[]) => {
  const grad = gradientString(colors);
  return (str: string) => (process.stdout.isTTY && chalk.level > 0) ? grad(str) : str;
};

// ─── Color Palette ──────────────────────────────────────────────
const BLOOD_GRADIENT = createGradient(['#7f1d1d', '#ef4444', '#dc2626', '#b91c1c']);
const VOUGHT_GRADIENT = createGradient(['#1e3a8a', '#1d4ed8', '#fbbf24', '#f59e0b']);
const GRITTY_GRADIENT = createGradient(['#262626', '#525252', '#a3a3a3', '#fafafa']);
const OCEAN_GRADIENT = BLOOD_GRADIENT; // Redirect legacy for consistency
const GOLD_GRADIENT = VOUGHT_GRADIENT;
const NEON_GRADIENT = createGradient(['#ef4444', '#1d4ed8', '#000000']);
const LUXE_GRADIENT = createGradient(['#000000', '#ef4444', '#000000']);
const EMBER_GRADIENT = BLOOD_GRADIENT;

// ─── Fish ASCII Art ─────────────────────────────────────────────
// The fish is now aggressive and supe-like
export const FISH_FRAMES = [
  `      ><(((º>  🔪`,
  `       ><(((º> 🔪`,
  `        ><(((º>🔪`,
  `         ><(((º>🔪`,
  `        ><(((º> 🔪`,
  `       ><(((º>  🔪`,
];

export const FISH_SWIM_FRAMES = [
  `  🩸 ><(((º>  🩸`,
  ` 🩸  ><(((º> 🩸`,
  `🩸   ><(((º>🩸`,
  ` 🩸  ><(((º> 🩸`,
];

export const FISH_DEAD = `  ><(((x>  💀`;
export const FISH_HAPPY = `  ><(((°>  🩸`;

export const BIG_FISH = [
  `           ╭────────────╮`,
  `    ╱╲    ╱              ╲`,
  `   ╱  ╲──╱    ●           ╲`,
  `  ╱    ╲╱                  ╲───╮`,
  `  ╲    ╱╲                  ╱───╯`,
  `   ╲  ╱──╲               ╱`,
  `    ╱╲╱   ╲              ╱`,
  `           ╰────────────╯`,
];

// ─── Premium Splash Screen (The Boys Edition) ──────────────────

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
  `                     🩸  .  🩸                    `,
  `                  ·  . 🔪 .  ·                  `,
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

const TAGLINE = `Diabolical AI · Scorched Earth · Your Way`;
const SUBTITLE = `Uncensored & Autonomous — Powered by Compound V`;

// ─── Animated Splash ────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function hideCursor(): void {
  process.stdout.write('\x1b[?25l');
}

function showCursor(): void {
  process.stdout.write('\x1b[?25h');
}

/**
 * Character-specific TTS voices for macOS
 */
const CHARACTER_VOICES: Record<string, string> = {
  'HOMELANDER': 'Daniel',
  'BUTCHER': 'Oliver',
  'FRENCHIE': 'Thomas',
  'ASHLEY': 'Samantha',
};

export function speak(text: string, character?: string): void {
  if (process.platform !== 'darwin') return; // Only support macOS for now

  // ─── Azerclaw 2.1: TTS Policy ───
  try {
    const { getConfigManager } = require('../../config/manager');
    const config = getConfigManager().getAll();
    if (!config.ui.ttsEnabled) return;
  } catch (e) {
    if (process.env.AZERCLAW_DEBUG) {
      console.error('[TTS] Config check failed:', e instanceof Error ? e.message : String(e));
    }
    return;
  }

  const voice = character ? CHARACTER_VOICES[character.toUpperCase()] : 'Daniel';
  const cleanText = text.replace(/["*_`]/g, '').slice(0, 200); // Strip markdown and limit length

  try {
    const { execFile } = require('child_process');
    execFile('say', ['-v', voice || 'Daniel', cleanText], (err: unknown) => {
      if (err && process.env.AZERCLAW_DEBUG) {
        console.error('[TTS Error]', err instanceof Error ? err.message : String(err));
      }
    });
  } catch (e) {
    if (process.env.AZERCLAW_DEBUG) {
      console.error('[TTS] execFile failed:', e instanceof Error ? e.message : String(e));
    }
  }
}

export async function playSplashScreen(version: string): Promise<void> {
  hideCursor();
  try {
  const termWidth = process.stdout.columns || 80;
  
  console.log('');
  for (let row = 0; row < SPLASH_LOGO.length; row++) {
    const line = SPLASH_LOGO[row];
    const pad = Math.max(0, Math.floor((termWidth - line.length) / 2));
    process.stdout.write(' '.repeat(pad) + BLOOD_GRADIENT(line) + '\n');
    await sleep(30);
  }
  
  await sleep(100);
  for (let row = 0; row < SPLASH_FISH_ART.length; row++) {
    const line = SPLASH_FISH_ART[row];
    const pad = Math.max(0, Math.floor((termWidth - line.length) / 2));
    process.stdout.write(' '.repeat(pad) + BLOOD_GRADIENT(line) + '\n');
    await sleep(20);
  }
  
  await sleep(150);
  const tagPad = Math.max(0, Math.floor((termWidth - TAGLINE.length) / 2));
  process.stdout.write(' '.repeat(tagPad));
  for (const char of TAGLINE) {
    process.stdout.write(VOUGHT_GRADIENT(char));
    await sleep(15);
  }
  process.stdout.write('\n');
  
  const subPad = Math.max(0, Math.floor((termWidth - SUBTITLE.length) / 2));
  console.log(' '.repeat(subPad) + chalk.bold.red(SUBTITLE));
  
  const versionStr = `v${version}-DIABOLICAL`;
  const vPad = Math.max(0, Math.floor((termWidth - versionStr.length - 4) / 2));
  console.log(' '.repeat(vPad) + chalk.bgRed.black(` ${versionStr} `) + '\n');
  } finally {
    showCursor();
  }
}

export function printQuickSplash(version: string): void {
  const termWidth = process.stdout.columns || 80;
  const fishLine = `  🔪 ><(((º>  AZERCLAW v${version} (Diabolical)`;
  const pad = Math.max(0, Math.floor((termWidth - fishLine.length) / 2));
  console.log('');
  console.log(' '.repeat(pad) + BLOOD_GRADIENT(fishLine));
  console.log(' '.repeat(pad) + chalk.dim(`  Diabolical AI · Scorched Earth · Your Way`));
  console.log('');
}

const THE_BOYS_QUOTES = [
  "Diabolical.",
  "I can do whatever the fuck I want.",
  "Well, well, well, if it ain't the invisible cunt.",
  "Scorched earth.",
  "You guys are the real heroes.",
  "I'll laser every fucking one of you!",
  "Don't you worry. Daddy's home.",
  "With great power comes the absolute certainty that you'll turn into a right cunt.",
  "Translucent doesn't even mean semi-transparent. It means semi-opaque.",
  "Fuck you, Homelander.",
  "Oi! Cunt!",
  "Eeny, meeny, miny, moe... I catch a supe by his toe.",
  "Now, if you'll excuse me, I have a fucking world to save.",
  "I'm the upgrade.",
  "Starlight, star bright, why don't you go fuck yourself tonight?",
];

// ─── Thinking Animation ─────────────────────────────────────────

export class FishThinkingAnimation {
  private interval: NodeJS.Timeout | null = null;
  private frameIndex = 0;
  private message: string;
  private unusedQuotes: string[] = [];
  private currentQuote = '';
  private quoteDisplayLength = 0;
  private quotePauseTicks = 0;
  private maxQuotePauseTicks = 30; // Pause after typing
  private loaders = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  constructor(message: string = 'Plotting') {
    this.message = message;
  }

  private getNextQuote(): string {
    if (this.unusedQuotes.length === 0) {
      this.unusedQuotes = [...THE_BOYS_QUOTES].sort(() => Math.random() - 0.5);
    }
    return this.unusedQuotes.pop() || THE_BOYS_QUOTES[0];
  }

  start(): void {
    if (!process.stdout.isTTY) {
      console.log(`[Thinking] ${this.message}...`);
      return;
    }
    hideCursor();
    this.frameIndex = 0;
    this.quoteDisplayLength = 0;
    this.quotePauseTicks = 0;
    this.unusedQuotes = [];
    this.currentQuote = this.getNextQuote();
    
    this.interval = setInterval(() => {
      const fish = FISH_FRAMES[this.frameIndex % FISH_FRAMES.length];
      const loader = this.loaders[this.frameIndex % this.loaders.length];
      
      // Typographic animation logic
      if (this.quoteDisplayLength < this.currentQuote.length) {
        // Speed up typing by adding 1-3 chars per frame
        this.quoteDisplayLength += Math.floor(Math.random() * 3) + 1;
        if (this.quoteDisplayLength > this.currentQuote.length) {
          this.quoteDisplayLength = this.currentQuote.length;
        }
      } else {
        this.quotePauseTicks++;
        if (this.quotePauseTicks > this.maxQuotePauseTicks) {
          // Choose a new non-repeating quote
          this.currentQuote = this.getNextQuote();
          this.quoteDisplayLength = 0;
          this.quotePauseTicks = 0;
        }
      }
      
      const visibleQuote = this.currentQuote.substring(0, this.quoteDisplayLength);
      const cursor = this.quoteDisplayLength < this.currentQuote.length ? '█' : (this.frameIndex % 4 < 2 ? '█' : ' ');
      
      process.stdout.write('\r\x1b[2K');
      process.stdout.write(
        BLOOD_GRADIENT(fish) + 
        chalk.red(` ${loader} `) + 
        chalk.bold.white(`${this.message}... `) +
        chalk.dim(`"`) + chalk.yellow(visibleQuote) + chalk.red(cursor) + chalk.dim(`"`)
      );
      
      this.frameIndex++;
    }, 80); // Faster interval for smoother typography and animation
  }

  updateMessage(message: string): void {
    this.message = message;
  }

  stop(finalMessage?: string): void {
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
    if (!process.stdout.isTTY) {
      if (finalMessage) console.log(`[Done] ✓ ${finalMessage}`);
      return;
    }
    process.stdout.write('\r\x1b[2K');
    if (finalMessage) {
      process.stdout.write(BLOOD_GRADIENT(`  ><(((°>`) + chalk.bold.green(` ✓ ${finalMessage}`) + '\n');
    }
    showCursor();
  }

  fail(errorMessage?: string): void {
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
    if (!process.stdout.isTTY) {
      if (errorMessage) console.error(`[Error] ✗ ${errorMessage}`);
      return;
    }
    process.stdout.write('\r\x1b[2K');
    if (errorMessage) {
      process.stdout.write(BLOOD_GRADIENT(`  ><(((x>`) + chalk.bold.red(` ✗ ${errorMessage}`) + '\n');
    }
    showCursor();
  }
}


export function renderFishProgress(current: number, total: number, label: string = ''): void {
  if (!process.stdout.isTTY) {
    if (current >= total) console.log(`[Progress] 100% ${label}`);
    return;
  }
  const termWidth = process.stdout.columns || 80;
  const barWidth = Math.min(40, termWidth - 30);
  const progress = Math.min(1, current / total);
  const filled = Math.round(barWidth * progress);
  const empty = barWidth - filled;
  const percent = Math.round(progress * 100);
  
  const bar = 
    chalk.red('━'.repeat(Math.max(0, filled))) +
    BLOOD_GRADIENT('🔪') +
    chalk.dim('─'.repeat(Math.max(0, empty)));
  
  process.stdout.write(`\r\x1b[2K  ${bar} ${chalk.bold.red(percent + '%')}${label ? chalk.dim(` ${label}`) : ''}`);
  if (current >= total) process.stdout.write('\n');
}

export function fishSuccess(message: string): void {
  console.log(BLOOD_GRADIENT(`  ><(((°>`) + chalk.bold.green(` ✓ ${message}`));
}

export function fishError(message: string): void {
  console.log(BLOOD_GRADIENT(`  ><(((x>`) + chalk.bold.red(` ✗ ${message}`));
}

export function fishInfo(message: string): void {
  console.log(BLOOD_GRADIENT(`  ><(((º>`) + chalk.bold.blue(` ℹ ${message}`));
}

export function fishWarn(message: string): void {
  console.log(BLOOD_GRADIENT(`  ><(((º>`) + chalk.bold.yellow(` ⚠ ${message}`));
}

export function fishBox(title: string, content: string[], options: { width?: number } = {}): void {
  const width = options.width || Math.min(60, (process.stdout.columns || 80) - 4);
  const innerWidth = width - 4;
  console.log(chalk.red(`  ┏${'━'.repeat(width - 2)}┓`));
  console.log(chalk.red('  ┃ ') + chalk.bold.yellow(title.padStart(Math.floor((innerWidth + title.length)/2)).padEnd(innerWidth)) + chalk.red(' ┃'));
  console.log(chalk.red(`  ┣${'━'.repeat(width - 2)}┫`));
  for (const line of content) {
    const stripped = line.replace(/\x1b\[[0-9;]*m/g, '');
    console.log(chalk.red('  ┃ ') + line + ' '.repeat(Math.max(0, innerWidth - stripped.length)) + chalk.red(' ┃'));
  }
  console.log(chalk.red(`  ┗${'━'.repeat(width - 2)}┛`));
}

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
  speak,
  CHARACTER_VOICES,
  OCEAN_GRADIENT,
  GOLD_GRADIENT,
  NEON_GRADIENT,
  LUXE_GRADIENT,
  EMBER_GRADIENT,
};
