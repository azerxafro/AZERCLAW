/**
 * 🐟 AZERCLAW Chat Command
 * Interactive conversational mode with streaming responses and tool use.
 */

const chalk = require('chalk');
const gradientString = require('gradient-string');
const readline = require('readline');
const { AgentRuntime } = require('../../core/runtime');
const { getToolRegistry } = require('../../tools/registry');
const { shellTool } = require('../../tools/shell');
const { readFileTool, writeFileTool, listDirTool, searchFilesTool } = require('../../tools/filesystem');
const { spawnSubAgentTool, webSearchTool, codeAnalysisTool } = require('../../tools/advanced');
const { FishThinkingAnimation, fishSuccess, fishError, fishInfo, fishBox } = require('../animations/fish');

const LUXE = gradientString(['#c084fc', '#818cf8', '#60a5fa', '#34d399']);
const OCEAN = gradientString(['#0ea5e9', '#06b6d4', '#14b8a6']);
const EMBER = gradientString(['#fbbf24', '#f59e0b', '#ef4444']);

function registerAllTools(): void {
  const registry = getToolRegistry();
  registry.register(shellTool);
  registry.register(readFileTool);
  registry.register(writeFileTool);
  registry.register(listDirTool);
  registry.register(searchFilesTool);
  registry.register(spawnSubAgentTool);
  registry.register(webSearchTool);
  registry.register(codeAnalysisTool);
}

export async function runChat(options: { model?: string; provider?: string }): Promise<void> {
  registerAllTools();

  const thinking = new FishThinkingAnimation('Initializing');
  let isThinking = false;

  const agent = new AgentRuntime({
    eventHandler: async (event: any) => {
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
    },
  });

  // Chat UI header
  fishBox('🐟 AZERCLAW Chat', [
    chalk.dim('Type your message and press Enter.'),
    chalk.dim('Commands: /exit, /clear, /model, /help'),
    '',
    LUXE('><(((º>  Ready to assist'),
  ]);
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: OCEAN('  🐟 > '),
    terminal: true,
  });

  rl.prompt();

  rl.on('line', async (line: string) => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }

    // Handle slash commands
    if (input.startsWith('/')) {
      switch (input.toLowerCase()) {
        case '/exit':
        case '/quit':
        case '/q':
          fishSuccess('Goodbye! 🐟');
          rl.close();
          process.exit(0);
          break;
        case '/clear':
          console.clear();
          fishInfo('Chat cleared');
          break;
        case '/help':
          fishBox('Commands', [
            chalk.hex('#60a5fa')('/exit    ') + chalk.dim('— Exit chat'),
            chalk.hex('#60a5fa')('/clear   ') + chalk.dim('— Clear screen'),
            chalk.hex('#60a5fa')('/model   ') + chalk.dim('— Show current model'),
            chalk.hex('#60a5fa')('/help    ') + chalk.dim('— This help'),
          ]);
          break;
        case '/model':
          const { getConfigManager } = require('../../config/manager');
          const cfg = getConfigManager().getAll();
          fishInfo(`Provider: ${cfg.ai.defaultProvider} | Model: ${cfg.ai.providers[cfg.ai.defaultProvider as keyof typeof cfg.ai.providers]?.defaultModel || 'default'}`);
          break;
        default:
          fishError(`Unknown command: ${input}`);
      }
      rl.prompt();
      return;
    }

    try {
      await agent.chat(input);
    } catch (error: any) {
      fishError(error.message || 'Something went wrong');
    }

    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

module.exports = { runChat, registerAllTools };
