/**
 * 🐟 AZERCLAW Run Command
 * Execute a single task and exit.
 */

const chalk = require('chalk');
const gradientString = require('gradient-string');
const { AgentRuntime } = require('../../core/runtime');
const { FishThinkingAnimation, fishSuccess, fishError, fishBox } = require('../animations/fish');

const LUXE = gradientString(['#c084fc', '#818cf8', '#60a5fa', '#34d399']);
const OCEAN = gradientString(['#0ea5e9', '#06b6d4', '#14b8a6']);

export async function runTask(task: string, options: { model?: string; verbose?: boolean }): Promise<void> {
  const { registerAllTools } = require('../../tools/index');
  await registerAllTools();
  const thinking = new FishThinkingAnimation('Working');
  let isThinking = false;
  let toolCount = 0;

  console.log('');
  console.log(OCEAN('  ><(((º>') + chalk.dim(` Task: ${task.slice(0, 70)}${task.length > 70 ? '...' : ''}`));
  console.log('');

  const agent = new AgentRuntime({
    eventHandler: async (event: any) => {
      switch (event.type) {
        case 'thinking':
          if (!isThinking) { isThinking = true; thinking.start(); }
          break;
        case 'response':
          if (isThinking) { thinking.stop(); isThinking = false; }
          if (event.content) {
            console.log(chalk.hex('#c4b5fd')('  ┌─ 🐟 Result'));
            event.content.split('\n').forEach((line: string) => {
              console.log(chalk.hex('#6366f1')('  │ ') + chalk.hex('#e2e8f0')(line));
            });
            console.log(chalk.hex('#c4b5fd')('  └─'));
          }
          break;
        case 'tool_call':
          toolCount++;
          if (isThinking) thinking.updateMessage(`Tool: ${event.toolName}`);
          if (options.verbose) {
            console.log(chalk.hex('#818cf8')(`  🔧 ${event.toolName}(${JSON.stringify(event.toolArgs).slice(0, 80)})`));
          }
          break;
        case 'sub_agent_spawn':
          console.log(chalk.hex('#818cf8')(`  🐠 Sub-agent: ${event.content?.slice(0, 60)}`));
          break;
        case 'error':
          if (isThinking) { thinking.fail(event.error); isThinking = false; }
          else fishError(event.error || 'Error');
          break;
        case 'done':
          if (isThinking) { thinking.stop(); isThinking = false; }
          break;
      }
    },
  });

  try {
    await agent.run(task);
    console.log('');
    fishSuccess(`Completed with ${toolCount} tool call(s)`);
  } catch (error: any) {
    fishError(error.message || 'Task failed');
    process.exit(1);
  }
}

module.exports = { runTask };
