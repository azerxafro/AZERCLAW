/**
 * 🐟 AZERTRON X1.0 Chat Command
 * Interactive conversational mode with streaming responses and tool use.
 * 
 * Slash commands (OpenClaw-style):
 *   /help         — Show all commands
 *   /exit         — Exit session
 *   /clear        — Clear screen and context
 *   /compact      — Summarize conversation to free context
 *   /model        — Switch model (interactive)
 *   /provider     — Switch provider (interactive)
 *   /apikey       — Change an API key
 *   /fallback     — Configure fallback provider
 *   /config       — Full settings menu
 *   /status       — Current status (model, provider, auth)
 *   /init         — Initialize project (AZERCLAW.md)
 *   /agents       — List Pantheon agents
 *   /AGENT task   — Invoke a specific agent
 */

const chalk = require('chalk');
const gradientString = require('gradient-string');
const readline = require('readline');
const { AutoComplete, Select } = require('enquirer');
const { AgentRuntime } = require('../../core/runtime');
const { getToolRegistry } = require('../../tools/registry');
const { shellTool } = require('../../tools/shell');
const { readFileTool, writeFileTool, listDirTool, searchFilesTool } = require('../../tools/filesystem');
const { spawnSubAgentTool, webSearchTool, codeAnalysisTool } = require('../../tools/advanced');
const { FishThinkingAnimation, fishSuccess, fishError, fishInfo, fishBox, fishWarn } = require('../animations/fish');
const { getConfigManager } = require('../../config/manager');

const LUXE = gradientString(['#c084fc', '#818cf8', '#60a5fa', '#34d399']);
const OCEAN = gradientString(['#0ea5e9', '#06b6d4', '#14b8a6']);
const EMBER = gradientString(['#fbbf24', '#f59e0b', '#ef4444']);

export async function runChat(options: { model?: string; provider?: string; initialMessage?: string }): Promise<void> {
  const config = getConfigManager();

  // Apply CLI flag overrides
  if (options.model || options.provider) {
    config.applyRuntimeOverrides(options);
  }

  const { registerAllTools } = require('../../tools/index');
  await registerAllTools();

  // Initialize memory
  const { getSessionStore, getContextStore } = require('../../memory/store');
  const sessionStore = getSessionStore();
  const contextStore = getContextStore();
  const session = sessionStore.create();
  const contextPrompt = contextStore.toPromptContext();

  const thinking = new FishThinkingAnimation('Initializing');
  let isThinking = false;
  let messageCount = 0;
  let isDropdownOpen = false;

  const chatEventHandler = async (event: any) => {
    switch (event.type) {
      case 'thinking':
        if (!isThinking) {
          isThinking = true;
          thinking.start();
        }
        break;

      case 'response':
        if (isThinking) {
          thinking.stop();
          isThinking = false;
        }
        if (event.content) {
          messageCount++;
          console.log('');
          console.log(chalk.hex('#c4b5fd')('  ┌─ 🐟 Azerclaw'));
          const lines = event.content.split('\n');
          for (const line of lines) {
            console.log(chalk.hex('#6366f1')('  │ ') + chalk.hex('#e2e8f0')(line));
          }
          console.log(chalk.hex('#c4b5fd')('  └─'));
          console.log('');
        }
        break;

      case 'tool_call':
        if (isThinking) { thinking.updateMessage(`Using ${event.toolName}`); }
        break;

      case 'tool_result':
        if (event.toolResult?.success) {
          // Silently process — agent will use the result
        } else if (event.toolResult?.error) {
          if (isThinking) { thinking.fail(event.toolResult.error); isThinking = false; }
        }
        break;

      case 'sub_agent_spawn':
        console.log(chalk.hex('#818cf8')(`  🐠 Sub-agent spawned: ${event.content?.slice(0, 60)}...`));
        break;

      case 'sub_agent_done':
        console.log(chalk.hex('#34d399')(`  🐠 Sub-agent completed`));
        break;

      case 'error':
        if (isThinking) { thinking.fail(event.error); isThinking = false; }
        else fishError(event.error || 'Unknown error');
        break;

      case 'done':
        if (isThinking) { thinking.stop('Done'); isThinking = false; }
        break;
    }
  };

  let agent = new AgentRuntime({
    sessionId: session.id,
    eventHandler: chatEventHandler,
  });

  // Chat UI header — show current model/provider
  const renderHeader = () => {
    const status = config.getStatus();
    fishBox('🐟 AZERTRON X1.0', [
      chalk.dim('  Type your message and press Enter. Type / for commands.'),
      '',
      `  ${chalk.hex('#818cf8')('Provider:')}  ${chalk.hex('#34d399')(status.provider)}  ${chalk.hex('#818cf8')('Model:')}  ${chalk.hex('#34d399')(status.model)}`,
      status.fallback ? `  ${chalk.hex('#818cf8')('Fallback:')}  ${chalk.hex('#34d399')(status.fallback)}` : '',
      '',
      LUXE('  ><(((º>  Ready to assist'),
    ].filter(Boolean));
    console.log('');
  };

  renderHeader();

  // Watch for external config changes (app sync)
  config.watch();
  config.on('change', () => {
    const { resetRouter } = require('../../providers/router');
    resetRouter();
    // Silently updated runtime config
  });

  const commands = [
    '/help', '/exit', '/clear', '/compact', '/model', '/provider', 
    '/apikey', '/fallback', '/config', '/status', '/init', '/agents',
    '/history', '/undo',
    '/ZEUS', '/ORION', '/ATLAS', '/HERA', '/HERMES', '/APOLLO', '/ATHENA', 
    '/ARES', '/HEPHAESTUS', '/DEMETER', '/ARTEMIS', '/POSEIDON'
  ];

  const completer = (line: string) => {
    const hits = commands.filter((c) => c.startsWith(line));
    return [hits.length ? hits : commands, line];
  };

  const getPrompt = () => {
    const s = sessionStore.get(agent.getSessionId());
    const tokens = s ? s.tokenCount : 0;
    const tokenStr = tokens > 1000 ? `${(tokens / 1000).toFixed(1)}K` : tokens;
    return OCEAN(`  🐟 [${tokenStr}] > `);
  };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: getPrompt(),
    terminal: true,
    completer,
  });

  // Enable ESC to abort
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  process.stdin.on('keypress', async (str, key) => {
    if (key.name === 'escape') {
      if (isThinking) {
        agent.abort();
        thinking.stop('Aborted by user (ESC)');
        isThinking = false;
        rl.prompt();
      }
    }
    // Handle Ctrl+C manually since we are in raw mode
    if (key.ctrl && key.name === 'c') {
      process.exit(0);
    }

    // Trigger Dropdown Menu on typing '/'
    if (!isDropdownOpen && str === '/' && rl.line.trim() === '/') {
      isDropdownOpen = true;
      
      // Pause readline to prevent interference
      rl.pause();
      
      // Clear the '/' that readline just printed and the internal buffer
      readline.moveCursor(process.stdout, -rl.line.length, 0);
      readline.clearLine(process.stdout, 1);
      rl.write(null, {ctrl: true, name: 'u'});
      
      try {
        const prompt = new AutoComplete({
          name: 'command',
          message: 'Select a command:',
          limit: 10,
          choices: commands
        });
        
        const answer = await prompt.run();
        isDropdownOpen = false;
        rl.resume();
        // Manually trigger the line event with the selected command
        rl.emit('line', answer);
      } catch (e) {
        isDropdownOpen = false;
        rl.resume();
        console.log('');
        rl.setPrompt(getPrompt());
        rl.prompt();
      }
    }
  });

  // Process initial message if provided
  if (options.initialMessage) {
    messageCount++;
    console.log(OCEAN('  🐟 > ') + chalk.dim('[initial context attached]'));
    try {
      await agent.chat(options.initialMessage);
    } catch (error: any) {
      fishError(error.message || 'Failed to process initial message');
    }
  }

  rl.prompt();

  rl.on('line', async (line: string) => {
    const input = line.trim();
    if (!input) { 
      rl.setPrompt(getPrompt());
      rl.prompt(); 
      return; 
    }

    // Handle slash commands
    let commandInput = input;
    if (commandInput === '/') commandInput = '/help';

    if (commandInput.startsWith('/')) {
      // Check for agent invocation: /ZEUS, /ORION, /ATLAS, etc.
      const agentMatch = commandInput.match(/^\/([A-Z]+)\s+(.*)/);
      if (agentMatch) {
        const agentName = agentMatch[1];
        let task = agentMatch[2];
        
        // Parse execution flags
        let flags = { turbo: false, auto: false, review: false, collab: false, secure: false };
        const flagPattern = /\/\/(turbo|auto|review|collab|secure)/g;
        let flagMatch;
        while ((flagMatch = flagPattern.exec(task)) !== null) {
          (flags as any)[flagMatch[1]] = true;
        }
        task = task.replace(flagPattern, '').trim();
        
        const { getAgent, createAgent, formatAgentRoster } = require('../../agents/builtin');
        
        if (agentName === 'PANTHEON' || agentName === 'ALL') {
          console.log(formatAgentRoster());
          fishInfo('Multi-agent collaboration coming soon. Use /AGENT_NAME [task] for now.');
          rl.setPrompt(getPrompt());
          rl.prompt();
          return;
        }
        
        const agentDef = getAgent(agentName);
        if (!agentDef) {
          fishError(`Unknown agent: ${agentName}. Type /agents to see available agents.`);
          rl.setPrompt(getPrompt());
          rl.prompt();
          return;
        }
        
        console.log(chalk.hex('#818cf8')(`  ${agentDef.emoji} ${agentDef.codename} activated — ${agentDef.role}`));
        if (flags.turbo) console.log(chalk.hex('#fbbf24')('  ⚡ TURBO mode — auto-executing without confirmation'));
        if (flags.auto) console.log(chalk.hex('#34d399')('  🤖 AUTO mode — full autonomous execution'));
        
        const subAgent = createAgent(agentDef, async (event: any) => {
          if (event.type === 'response' && event.content) {
            console.log('');
            console.log(chalk.hex('#c4b5fd')(`  ┌─ ${agentDef.emoji} ${agentDef.codename}`));
            const lines = event.content.split('\n');
            for (const l of lines) {
              console.log(chalk.hex('#6366f1')('  │ ') + chalk.hex('#e2e8f0')(l));
            }
            console.log(chalk.hex('#c4b5fd')('  └─'));
            console.log('');
          }
        });
        
        try {
          await subAgent.run(task);
        } catch (error: any) {
          fishError(`${agentDef.codename} error: ${error.message}`);
        }
        rl.setPrompt(getPrompt());
        rl.prompt();
        return;
      }
      
      switch (commandInput.toLowerCase()) {
        case '/exit':
        case '/quit':
        case '/q':
          fishSuccess('Goodbye! 🐟');
          rl.close();
          process.exit(0);
          break;
        case '/clear':
        case '/reset':
        case '/new':
          console.clear();
          agent.clearHistory();
          messageCount = 0;
          fishInfo('Conversation cleared');
          break;
        case '/compact': {
          fishInfo('Compacting conversation history...');
          const history = agent.getHistory();
          if (history.length < 4) {
            fishWarn('Conversation is too short to compact.');
            break;
          }

          const { getRouter } = require('../../providers/router');
          const router = getRouter();
          
          const summaryThinking = new FishThinkingAnimation('Summarizing');
          summaryThinking.start();
          
          try {
            const summaryResult = await router.complete({
              messages: [
                ...history,
                { role: 'user', content: 'Summarize our conversation so far in a concise way to preserve context for future turns. Focus on key decisions, technical details, and progress made. Keep it under 500 words.' }
              ],
              systemPrompt: 'You are a context compression assistant. Output ONLY the summary.',
              maxTokens: 1000,
            });
            
            summaryThinking.stop();
            
            if (summaryResult.finishReason !== 'error') {
              agent.setHistory([
                { role: 'system', content: `Previous Conversation Summary:\n${summaryResult.content}` }
              ]);
              messageCount = 1;
              fishSuccess('Conversation compacted into a summary.');
            } else {
              fishError(`Compaction failed: ${summaryResult.content}`);
            }
          } catch (e: any) {
            summaryThinking.fail(e.message);
          }
          break;
        }
        case '/status': {
          const { showStatus } = require('./settings');
          showStatus();
          break;
        }
        case '/config':
        case '/settings': {
          const { interactiveSettingsMenu } = require('./settings');
          await interactiveSettingsMenu();
          break;
        }
        case '/model': {
          const { interactiveModelSwitch } = require('./settings');
          await interactiveModelSwitch();
          break;
        }
        case '/provider': {
          const { interactiveProviderSwitch } = require('./settings');
          await interactiveProviderSwitch();
          break;
        }
        case '/apikey': {
          const { interactiveApiKeyChange } = require('./settings');
          await interactiveApiKeyChange();
          break;
        }
        case '/fallback': {
          const { interactiveFallbackConfig } = require('./settings');
          await interactiveFallbackConfig();
          break;
        }
        case '/init': {
          const { initProject } = require('./settings');
          initProject();
          break;
        }
        case '/history': {
          const recentSessions = sessionStore.getRecent(10);
          if (recentSessions.length === 0) {
            fishInfo('No past sessions found.');
            rl.setPrompt(getPrompt());
            rl.prompt();
            return;
          }
          
          try {
            isDropdownOpen = true;
            // Clear readline
            readline.moveCursor(process.stdout, -1, 0);
            readline.clearLine(process.stdout, 1);
            rl.write(null, {ctrl: true, name: 'u'});

            const choices = recentSessions.map((s: any) => {
              const date = new Date(s.updatedAt).toLocaleString();
              const tokens = s.tokenCount > 0 ? chalk.dim(` [${s.tokenCount} tokens]`) : '';
              return {
                name: s.id,
                message: `${chalk.hex('#818cf8')(date)} - ${s.title}${tokens}`
              };
            });

            const prompt = new Select({
              name: 'sessionId',
              message: 'Select a session to resume:',
              choices: choices,
            });

            const selectedSessionId = await prompt.run();
            isDropdownOpen = false;

            const selectedSession = sessionStore.get(selectedSessionId);
            if (selectedSession) {
              fishSuccess(`Resuming session: ${selectedSession.title}`);
              // Assign new agent runtime
              agent = new AgentRuntime({
                sessionId: selectedSessionId,
                eventHandler: chatEventHandler,
              });
              // Reset message count contextually
              messageCount = selectedSession.messages.length;
              renderHeader();
            }
          } catch (e) {
            isDropdownOpen = false;
            console.log('');
          }
          break;
        }
        case '/undo': {
          if (agent.undo()) {
            fishSuccess('Last exchange undone.');
            messageCount = agent.getHistory().length;
            rl.setPrompt(getPrompt());
          } else {
            fishWarn('Nothing to undo.');
          }
          break;
        }
        case '/agents': {
          const { formatAgentRoster } = require('../../agents/builtin');
          console.log('');
          console.log(formatAgentRoster());
          console.log('');
          fishInfo('Usage: /AGENT_NAME [task]  (e.g., /FRENCHIE write a REST API)');
          break;
        }
        case '/help':
          fishBox('Commands', [
            chalk.hex('#818cf8').bold('  Session'),
            chalk.hex('#60a5fa')('  /exit         ') + chalk.dim('— Exit session'),
            chalk.hex('#60a5fa')('  /clear        ') + chalk.dim('— Clear conversation'),
            chalk.hex('#60a5fa')('  /compact      ') + chalk.dim('— Compress context'),
            chalk.hex('#60a5fa')('  /history      ') + chalk.dim('— Browse and resume past sessions'),
            chalk.hex('#60a5fa')('  /undo         ') + chalk.dim('— Rollback last exchange'),
            '',
            chalk.hex('#818cf8').bold('  Configuration'),
            chalk.hex('#60a5fa')('  /model        ') + chalk.dim('— Switch model'),
            chalk.hex('#60a5fa')('  /provider     ') + chalk.dim('— Switch provider'),
            chalk.hex('#60a5fa')('  /apikey       ') + chalk.dim('— Change API key'),
            chalk.hex('#60a5fa')('  /fallback     ') + chalk.dim('— Set fallback provider'),
            chalk.hex('#60a5fa')('  /config       ') + chalk.dim('— Full settings menu'),
            chalk.hex('#60a5fa')('  /status       ') + chalk.dim('— Current status'),
            '',
            chalk.hex('#818cf8').bold('  Project'),
            chalk.hex('#60a5fa')('  /init         ') + chalk.dim('— Initialize project'),
            chalk.hex('#60a5fa')('  /agents       ') + chalk.dim('— List Pantheon agents'),
            chalk.hex('#60a5fa')('  /ZEUS task    ') + chalk.dim('— Invoke a specific agent'),
            '',
            chalk.dim('  Flags: //turbo //auto //review //collab //secure'),
          ]);
          break;
        default:
          fishError(`Unknown command: ${input}. Type /help for available commands.`);
      }
      rl.setPrompt(getPrompt());
      rl.prompt();
      return;
    }

    messageCount++;
    try {
      await agent.chat(input);
    } catch (error: any) {
      fishError(error.message || 'Something went wrong');
    }

    rl.setPrompt(getPrompt());
    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

module.exports = { runChat };
