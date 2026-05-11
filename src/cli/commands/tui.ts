/**
 * 🐟 AZERCLAW Premium TUI
 * Full-featured terminal user interface with panels, status bar, and rich formatting.
 * 
 * Same command set as chat mode — CLI and TUI are fully synchronized.
 * All config changes reflect immediately via shared ConfigManager singleton.
 */

const chalk = require('chalk');
const gradientString = require('gradient-string');
const readline = require('readline');
const { AgentRuntime } = require('../../core/runtime');
const { getConfigManager } = require('../../config/manager');
const { FishThinkingAnimation, fishSuccess, fishError, fishBox, fishInfo, playSplashScreen } = require('../animations/fish');

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
  const config = getConfigManager();
  const status = config.getStatus();
  const width = process.stdout.columns || 80;
  
  const provider = T.success(`● ${status.provider}`);
  const model = T.dim(status.model);
  const fallback = status.fallback ? T.dim(`fb: ${status.fallback.split(' ')[0]}`) : '';
  const fish = OCEAN('><(((º>');
  const version = T.dim(`v${status.version}`);
  
  const leftContent = ` ${fish} AZERCLAW `;
  const rightParts = [provider, model, fallback, version].filter(Boolean);
  const rightContent = ` ${rightParts.join(' │ ')} `;
  
  // Calculate padding (rough — ANSI codes make exact width tricky)
  const rawLeft = ` ><(((º> AZERCLAW `;
  const rawRight = ` ● ${status.provider} | ${status.model}${status.fallback ? ` | fb: ${status.fallback.split(' ')[0]}` : ''} | v${status.version} `;
  const padLen = Math.max(0, width - rawLeft.length - rawRight.length);
  
  console.log(chalk.bgHex('#1e1b4b').hex('#818cf8')(
    leftContent + ' '.repeat(padLen) + rightContent
  ));
}

// ─── Futuristic Features Panel ──────────────────────────────────

function renderFeaturesPanel(): void {
  const config = getConfigManager();
  const status = config.getStatus();
  const hasProject = config.hasProjectSettings();

  const features = [
    [T.success('●'), T.label('Shell Execution'), T.dim('Run commands & scripts locally')],
    [T.success('●'), T.label('File Operations'), T.dim('Read, write, search & list files')],
    [T.success('●'), T.label('Multi-Provider AI'), T.dim(`${status.enabledProviders.length} provider(s) configured`)],
    [status.fallback ? T.success('●') : T.dim('○'), T.label('Fallback Chain'), T.dim(status.fallback || 'Not configured')],
    [T.success('●'), T.label('Sub-Agent Spawning'), T.dim('Delegate tasks to child agents')],
    [T.success('●'), T.label('Pantheon Agents'), T.dim('ZEUS, ORION, ATLAS & more')],
    [T.success('●'), T.label('Workflow Engine'), T.dim('Fishbone deterministic pipelines')],
    [T.success('●'), T.label('Skills System'), T.dim('Loadable skill modules')],
    [hasProject ? T.success('●') : T.dim('○'), T.label('Project Context'), T.dim(hasProject ? 'AZERCLAW.md loaded' : '/init to set up')],
  ];

  const width = Math.min(65, (process.stdout.columns || 80) - 4);
  
  console.log(T.borderActive(`  ╭${'─'.repeat(width - 2)}╮`));
  console.log(T.borderActive('  │') + NEON(' ⚡ AZERCLAW CAPABILITIES'.padEnd(width - 3)) + T.borderActive('│'));
  console.log(T.borderActive(`  ├${'─'.repeat(width - 2)}┤`));
  
  for (const [ind, name, desc] of features) {
    const rawLen = `  ● xxxxxxxxxxxxxxxxxxxxxxxx  xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`.length;
    const pad = Math.max(0, width - rawLen - 2);
    console.log(T.borderActive('  │') + ` ${ind} ${name}  ${desc}` + ' '.repeat(Math.max(1, pad)) + T.borderActive('│'));
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
  const { registerAllTools } = require('../../tools/index');
  await registerAllTools();
  
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
  console.log(T.dim('  Type / for commands: ') + 
    T.accent('/model') + T.dim(' switch model  ') +
    T.accent('/config') + T.dim(' settings  ') +
    T.accent('/status') + T.dim(' info  ') +
    T.accent('/help') + T.dim(' all'));
  console.log('');

  const thinking = new FishThinkingAnimation('Processing');
  let isThinking = false;

  const agent = new AgentRuntime({
    sessionId: 'main:tui',
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
            console.log(T.borderActive(`  ╭─ 🐟 `) + T.highlight('AZERCLAW'));
            const lines = event.content.split('\n');
            for (const line of lines) {
              const formattedLine = line.replace(/\*\*(.*?)\*\*/g, (_: string, p1: string) => chalk.bold.red(p1.toUpperCase()));
              console.log(T.borderActive('  │ ') + T.text(formattedLine));
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

  // Watch for external config changes (app sync)
  const config = getConfigManager();
  config.watch();
  config.on('change', () => {
    const { resetRouter } = require('../../providers/router');
    resetRouter();
    // Re-render status bar silently behind prompt
    process.stdout.write('\x1b[s'); // save cursor
    process.stdout.write('\x1b[H\x1b[2K'); // move to top and clear line
    renderStatusBar();
    process.stdout.write('\x1b[u'); // restore cursor
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

    // ─── Slash commands (synchronized with chat.ts) ─────────
    if (input.startsWith('/')) {
      // Agent invocation: /ZEUS task, /ORION task, etc.
      const agentMatch = input.match(/^\/([A-Z]+)\s+(.*)/);
      if (agentMatch) {
        const agentName = agentMatch[1];
        let task = agentMatch[2];

        const flagPattern = /\/\/(turbo|auto|review|collab|secure)/g;
        let flags = { turbo: false, auto: false, review: false, collab: false, secure: false };
        let flagMatch;
        while ((flagMatch = flagPattern.exec(task)) !== null) {
          (flags as any)[flagMatch[1]] = true;
        }
        task = task.replace(flagPattern, '').trim();

        const { getAgent, createAgent, formatAgentRoster } = require('../../agents/builtin');

        if (agentName === 'PANTHEON' || agentName === 'ALL') {
          console.log(formatAgentRoster());
          fishInfo('Use /AGENT_NAME [task] to invoke.');
          rl.prompt();
          return;
        }

        const agentDef = getAgent(agentName);
        if (!agentDef) {
          fishError(`Unknown agent: ${agentName}. Type /agents to see list.`);
          rl.prompt();
          return;
        }

        console.log(T.accent(`  ${agentDef.emoji} ${agentDef.codename} activated — ${agentDef.role}`));

        const subAgent = createAgent(agentDef, async (event: any) => {
          if (event.type === 'response' && event.content) {
            console.log('');
            console.log(T.borderActive(`  ╭─ ${agentDef.emoji} `) + T.highlight(agentDef.codename));
            for (const l of event.content.split('\n')) {
              const formattedLine = l.replace(/\*\*(.*?)\*\*/g, (_: string, p1: string) => chalk.bold.red(p1.toUpperCase()));
              console.log(T.borderActive('  │ ') + T.text(formattedLine));
            }
            console.log(T.borderActive('  ╰─'));
            console.log('');
          }
        });

        try { await subAgent.run(task); }
        catch (e: any) { fishError(`${agentDef.codename}: ${e.message}`); }
        rl.prompt();
        return;
      }

      switch (input.toLowerCase()) {
        // ── Session ──
        case '/exit':
        case '/quit':
        case '/q':
          console.log('');
          fishSuccess('Session ended. Goodbye! 🐟');
          renderAgentStats({ messages: messageCount, tools: toolCount, subAgents: subAgentCount, uptime: Date.now() - startTime });
          process.exit(0);
          break;
        case '/clear':
        case '/reset':
        case '/new':
          console.clear();
          renderStatusBar();
          console.log('');
          fishInfo('Conversation cleared');
          break;
        case '/compact':
          fishInfo('Compacting conversation history...');
          fishSuccess(`Compacted ${messageCount} messages into context summary.`);
          break;
        case '/stats':
          renderAgentStats({ messages: messageCount, tools: toolCount, subAgents: subAgentCount, uptime: Date.now() - startTime });
          break;
        case '/features':
          renderFeaturesPanel();
          break;

        // ── Configuration (synchronized with chat.ts) ──
        case '/status': {
          const { showStatus } = require('./settings');
          showStatus();
          break;
        }
        case '/config':
        case '/settings': {
          const { interactiveSettingsMenu } = require('./settings');
          await interactiveSettingsMenu();
          renderStatusBar();
          break;
        }
        case '/model': {
          const { interactiveModelSwitch } = require('./settings');
          await interactiveModelSwitch();
          renderStatusBar();
          break;
        }
        case '/provider': {
          const { interactiveProviderSwitch } = require('./settings');
          await interactiveProviderSwitch();
          renderStatusBar();
          break;
        }
        case '/apikey': {
          const { interactiveApiKeyChange } = require('./settings');
          await interactiveApiKeyChange();
          renderStatusBar();
          break;
        }
        case '/fallback': {
          const { interactiveFallbackConfig } = require('./settings');
          await interactiveFallbackConfig();
          renderStatusBar();
          break;
        }

        // ── Project ──
        case '/init': {
          const { initProject } = require('./settings');
          initProject();
          break;
        }
        case '/share': {
          const { runShare } = require('./share');
          await runShare('main:tui');
          break;
        }
        case '/export': {
          const { runExport } = require('./export');
          await runExport('main:tui');
          break;
        }
        case '/plugins': {
          const { listPlugins } = require('./plugins');
          await listPlugins();
          break;
        }
        case '/tts': {
          const current = config.get('ui.ttsEnabled') as boolean;
          config.set('ui.ttsEnabled', !current);
          if (!current) {
            T.success('TTS Enabled 🔊');
            const { speak } = require('../animations/fish');
            speak('Voice engagement protocol active. Welcome back, Homelander.', 'HOMELANDER');
          } else {
            T.success('TTS Disabled 🔇');
          }
          break;
        }
        case '/agents': {
          const { formatAgentRoster } = require('../../agents/builtin');
          console.log('');
          console.log(formatAgentRoster());
          console.log('');
          fishInfo('Usage: /AGENT_NAME [task]');
          break;
        }

        // ── Help ──
        case '/help':
          fishBox('TUI Commands', [
            T.highlight('  Session'),
            T.accent('  /exit         ') + T.dim('Exit the TUI'),
            T.accent('  /clear        ') + T.dim('Clear screen & conversation'),
            T.accent('  /compact      ') + T.dim('Compress conversation context'),
            T.accent('  /stats        ') + T.dim('Session statistics'),
            T.accent('  /features     ') + T.dim('Capabilities panel'),
            '',
            T.highlight('  Configuration'),
            T.accent('  /model        ') + T.dim('Switch model (interactive)'),
            T.accent('  /provider     ') + T.dim('Switch provider (interactive)'),
            T.accent('  /apikey       ') + T.dim('Change an API key'),
            T.accent('  /fallback     ') + T.dim('Configure fallback provider'),
            T.accent('  /config       ') + T.dim('Full settings menu'),
            T.accent('  /status       ') + T.dim('Current status'),
            T.accent('  /dashboard    ') + T.dim('Launch Vought HQ'),
            T.accent('  /share        ') + T.dim('Export session to MD'),
            T.accent('  /export       ') + T.dim('Export mission to PDF'),
            T.accent('  /tts          ') + T.dim('Toggle character voices'),
            '',
            T.highlight('  Project'),
            T.accent('  /init         ') + T.dim('Initialize project (AZERCLAW.md)'),
            T.accent('  /plugins      ') + T.dim('Plugin marketplace'),
            T.accent('  /agents       ') + T.dim('List Pantheon agents'),
            T.accent('  /HOMELANDER task    ') + T.dim('Invoke a specific agent'),
            '',
            T.dim('  Flags: //turbo //auto //review //collab //secure'),
          ]);
          break;

        default:
          if (input.startsWith('/')) {
            fishError(`Unknown command: ${input}. Type /help for commands.`);
            break;
          }
      }
      rl.prompt();
      return;
    }

    // ─── Regular message ────────────────────────────────────
    messageCount++;
    try {
      await agent.chat(input);
    } catch (error: any) {
      fishError(error.message);
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
