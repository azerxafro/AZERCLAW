/**
 * 🐟 AZERCLAW Premium TUI
 * Full-featured terminal user interface with panels, status bar, and rich formatting.
 */

const chalk = require('chalk');
const gradientString = require('gradient-string');
const readline = require('readline');
const { AgentRuntime } = require('../../core/runtime');
const { registerAllTools } = require('./chat');
const { getConfigManager } = require('../../config/manager');
const { FishThinkingAnimation, fishSuccess, fishError, fishBox, playSplashScreen } = require('../animations/fish');

const LUXE = gradientString(['#c084fc', '#818cf8', '#60a5fa', '#34d399']);
const OCEAN = gradientString(['#0ea5e9', '#06b6d4', '#14b8a6']);
const NEON = gradientString(['#a855f7', '#6366f1', '#3b82f6', '#06b6d4']);

// ─── TUI Theme Colors ───────────────────────────────────────────

const T = {
  border: (s: string) => chalk.hex('#3b3b6b')(s),
  borderActive: (s: string) => chalk.hex('#818cf8')(s),
  label: (s: string) => chalk.hex('#a78bfa')(s),
  text: (s: string) => chalk.hex('#e2e8f0')(s),
  dim: (s: string) => chalk.hex('#6b7280')(s),
  accent: (s: string) => chalk.hex('#06b6d4')(s),
  success: (s: string) => chalk.hex('#34d399')(s),
  warning: (s: string) => chalk.hex('#fbbf24')(s),
  error: (s: string) => chalk.hex('#f87171')(s),
  highlight: (s: string) => chalk.hex('#c084fc')(s),
  bg: (s: string) => chalk.bgHex('#0f0f23').hex('#e2e8f0')(s),
};

// ─── Status Bar ─────────────────────────────────────────────────

function renderStatusBar(): void {
  const config = getConfigManager().getAll();
  const width = process.stdout.columns || 80;
  
  const provider = T.success(`● ${config.ai.defaultProvider}`);
  const model = T.dim((config.ai.providers as any)[config.ai.defaultProvider]?.defaultModel || 'auto');
  const fish = OCEAN('><(((º>');
  const version = T.dim('v1.0.0');
  
  const leftContent = ` ${fish} AZERCLAW `;
  const rightContent = ` ${provider} │ ${model} │ ${version} `;
  
  // Calculate padding (rough — ANSI codes make exact width tricky)
  const rawLeft = ` ><(((º> AZERCLAW `;
  const rawRight = ` ● ${config.ai.defaultProvider} | ${(config.ai.providers as any)[config.ai.defaultProvider]?.defaultModel || 'auto'} | v1.0.0 `;
  const padLen = Math.max(0, width - rawLeft.length - rawRight.length);
  
  console.log(chalk.bgHex('#1e1b4b').hex('#818cf8')(
    leftContent + ' '.repeat(padLen) + rightContent
  ));
}

// ─── Futuristic Features Panel ──────────────────────────────────

function renderFeaturesPanel(): void {
  const features = [
    [T.success('●'), T.label('Neural Code Synthesis'), T.dim('Deep code generation via AST analysis')],
    [T.success('●'), T.label('Ambient Awareness'), T.dim('Monitors file changes & git state')],
    [T.success('●'), T.label('Predictive Tasks'), T.dim('Anticipates next steps from patterns')],
    [T.warning('◐'), T.label('Quantum Search'), T.dim('Parallel multi-source code search')],
    [T.warning('◐'), T.label('Swarm Intelligence'), T.dim('Multi-agent collaborative solving')],
    [T.dim('○'), T.label('Temporal Debugging'), T.dim('Time-travel through code states')],
    [T.dim('○'), T.label('Holographic Preview'), T.dim('Real-time visual output prediction')],
    [T.dim('○'), T.label('Synaptic Memory'), T.dim('Cross-project pattern learning')],
  ];

  const width = Math.min(65, (process.stdout.columns || 80) - 4);
  
  console.log(T.borderActive(`  ╭${'─'.repeat(width - 2)}╮`));
  console.log(T.borderActive('  │') + NEON(' ⚡ AZERCLAW CAPABILITIES'.padEnd(width - 3)) + T.borderActive('│'));
  console.log(T.borderActive(`  ├${'─'.repeat(width - 2)}┤`));
  
  for (const [status, name, desc] of features) {
    const line = `  ${status} ${name}  ${desc}`;
    const rawLen = `  ● xxxxxxxxxxxxxxxxxxxxxxxx  xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`.length;
    const pad = Math.max(0, width - rawLen - 2);
    console.log(T.borderActive('  │') + ` ${status} ${name}  ${desc}` + ' '.repeat(Math.max(1, pad)) + T.borderActive('│'));
  }
  
  console.log(T.borderActive(`  ╰${'─'.repeat(width - 2)}╯`));
}

// ─── Agent Stats Panel ──────────────────────────────────────────

function renderAgentStats(stats: { messages: number; tools: number; subAgents: number; uptime: number }): void {
  const width = Math.min(45, (process.stdout.columns || 80) - 4);
  
  console.log(T.border(`  ╭${'─'.repeat(width - 2)}╮`));
  console.log(T.border('  │') + T.label(' 📊 Session Stats'.padEnd(width - 3)) + T.border('│'));
  console.log(T.border(`  ├${'─'.repeat(width - 2)}┤`));
  
  const lines = [
    `  Messages:   ${T.accent(String(stats.messages))}`,
    `  Tool Calls: ${T.accent(String(stats.tools))}`,
    `  Sub-Agents: ${T.accent(String(stats.subAgents))}`,
    `  Uptime:     ${T.accent(formatUptime(stats.uptime))}`,
  ];
  
  for (const line of lines) {
    console.log(T.border('  │') + ` ${line}`.padEnd(width + 20) + T.border('│'));
  }
  
  console.log(T.border(`  ╰${'─'.repeat(width - 2)}╯`));
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

// ─── Main TUI ───────────────────────────────────────────────────

export async function runTUI(): Promise<void> {
  registerAllTools();
  
  const startTime = Date.now();
  let messageCount = 0;
  let toolCount = 0;
  let subAgentCount = 0;

  // Clear screen and show splash
  console.clear();
  await playSplashScreen('1.0.0');
  
  // Status bar
  renderStatusBar();
  console.log('');
  
  // Features panel
  renderFeaturesPanel();
  console.log('');
  
  // Help bar
  console.log(T.dim('  Shortcuts: ') + 
    T.accent('Ctrl+C') + T.dim(' exit  ') +
    T.accent('/clear') + T.dim(' reset  ') +
    T.accent('/stats') + T.dim(' metrics  ') +
    T.accent('/help') + T.dim(' commands'));
  console.log('');

  const thinking = new FishThinkingAnimation('Processing');
  let isThinking = false;

  const agent = new AgentRuntime({
    eventHandler: async (event: any) => {
      switch (event.type) {
        case 'thinking':
          if (!isThinking) { isThinking = true; thinking.start(); }
          break;
        case 'response':
          if (isThinking) { thinking.stop(); isThinking = false; }
          if (event.content) {
            messageCount++;
            // Render response in a styled box
            const width = Math.min(75, (process.stdout.columns || 80) - 4);
            console.log('');
            console.log(T.borderActive(`  ╭─ 🐟 `) + T.highlight('Azerclaw'));
            const lines = event.content.split('\n');
            for (const line of lines) {
              console.log(T.borderActive('  │ ') + T.text(line));
            }
            console.log(T.borderActive('  ╰─'));
            console.log('');
          }
          break;
        case 'tool_call':
          toolCount++;
          if (isThinking) thinking.updateMessage(`🔧 ${event.toolName}`);
          break;
        case 'sub_agent_spawn':
          subAgentCount++;
          console.log(T.accent(`  🐠 Sub-agent deployed → ${event.content?.slice(0, 50)}`));
          break;
        case 'sub_agent_done':
          console.log(T.success(`  🐠 Sub-agent completed ✓`));
          break;
        case 'error':
          if (isThinking) { thinking.fail(event.error); isThinking = false; }
          break;
        case 'done':
          if (isThinking) { thinking.stop(); isThinking = false; }
          break;
      }
    },
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: NEON('\n  ⟫ '),
    terminal: true,
  });

  rl.prompt();

  rl.on('line', async (line: string) => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }

    switch (input.toLowerCase()) {
      case '/exit':
      case '/quit':
      case '/q':
        console.log('');
        fishSuccess('Session ended. Goodbye! 🐟');
        renderAgentStats({ messages: messageCount, tools: toolCount, subAgents: subAgentCount, uptime: Date.now() - startTime });
        process.exit(0);
        break;
      case '/clear':
        console.clear();
        renderStatusBar();
        console.log('');
        break;
      case '/stats':
        renderAgentStats({ messages: messageCount, tools: toolCount, subAgents: subAgentCount, uptime: Date.now() - startTime });
        break;
      case '/features':
        renderFeaturesPanel();
        break;
      case '/help':
        fishBox('TUI Commands', [
          T.accent('/exit     ') + T.dim('Exit the TUI'),
          T.accent('/clear    ') + T.dim('Clear screen'),
          T.accent('/stats    ') + T.dim('Session statistics'),
          T.accent('/features ') + T.dim('Capabilities panel'),
          T.accent('/model    ') + T.dim('Current model info'),
          T.accent('/help     ') + T.dim('This help'),
        ]);
        break;
      case '/model':
        const { getConfigManager: gcm } = require('../../config/manager');
        const cfg = gcm().getAll();
        fishBox('Current Model', [
          T.label('Provider: ') + T.accent(cfg.ai.defaultProvider),
          T.label('Model:    ') + T.accent((cfg.ai.providers as any)[cfg.ai.defaultProvider]?.defaultModel || 'auto'),
        ]);
        break;
      default:
        if (input.startsWith('/')) {
          fishError(`Unknown command: ${input}`);
          break;
        }
        messageCount++;
        try {
          await agent.chat(input);
        } catch (error: any) {
          fishError(error.message);
        }
    }
    rl.prompt();
  });

  rl.on('close', () => {
    console.log('');
    fishSuccess('Session ended 🐟');
    process.exit(0);
  });
}

module.exports = { runTUI };
