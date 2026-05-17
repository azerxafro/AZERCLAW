/**
 * 🐟 AZERCLAW Agents CLI Command
 * List, invoke, and manage the Pantheon of built-in agents.
 */

import chalk from 'chalk';
import gradientString from 'gradient-string';
import { listAgents, getAgent, createAgent, matchAgentForTask, formatAgentRoster } from '../../agents/builtin';
import { parseAgentCommand, resolveGroupCommand } from '../../agents/loader';
import { getToolRegistry } from '../../tools/registry';
import { fishSuccess, fishError, fishInfo, fishBox, FishThinkingAnimation } from '../animations/fish';

const LUXE = gradientString(['#c084fc', '#818cf8', '#60a5fa', '#34d399']);

// ─── List all agents ────────────────────────────────────────────

export function agentsList(): void {
  const agents = listAgents();

  console.log('');
  console.log(LUXE('  ═══════════════════════════════════════════════════════'));
  console.log(LUXE('              ⚡ THE AZERCLAW PANTHEON ⚡'));
  console.log(LUXE('  ═══════════════════════════════════════════════════════'));
  console.log('');

  for (const agent of agents) {
    const emoji = agent.emoji.padEnd(4);
    const codename = chalk.bold.hex('#e2e8f0')(agent.codename.padEnd(14));
    const role = chalk.hex('#818cf8')(agent.role.padEnd(22));
    const tags = chalk.dim(agent.tags.slice(0, 4).join(', '));
    console.log(`  ${emoji}${codename}${role}${tags}`);
  }

  console.log('');
  console.log(chalk.dim('  Usage: azerclaw agent invoke <name> <task>'));
  console.log(chalk.dim('  Chat:  Type /HOMELANDER, /FRENCHIE, /MOTHERS_MILK etc. in chat mode'));
  console.log('');
}

// ─── Invoke a specific agent ────────────────────────────────────

export async function agentInvoke(name: string, task: string, opts: any): Promise<void> {
  const agent = getAgent(name);
  if (!agent) {
    fishError(`Agent "${name}" not found. Run 'azerclaw agents list' to see available agents.`);
    return;
  }

  // Register tools
  registerTools();

  console.log('');
  fishBox(`${agent.emoji} ${agent.codename} — ${agent.role}`, [
    chalk.dim(agent.description),
    '',
    chalk.hex('#818cf8')(`Task: ${task.slice(0, 60)}${task.length > 60 ? '...' : ''}`),
  ]);
  console.log('');

  const thinking = new FishThinkingAnimation();
  let toolCalls = 0;

  const runtime = createAgent(agent, async (event: any) => {
    switch (event.type) {
      case 'thinking':
        thinking.start();
        break;
      case 'response':
        thinking.stop();
        if (event.content) {
          console.log(`  ${chalk.hex('#34d399')('┌─')} ${agent.emoji} ${chalk.bold(agent.codename)}`);
          console.log(`  ${chalk.hex('#34d399')('│')} ${event.content}`);
          console.log(`  ${chalk.hex('#34d399')('└─')}`);
        }
        break;
      case 'tool_call':
        thinking.stop();
        toolCalls++;
        console.log(chalk.hex('#818cf8')(`  🔧 ${event.toolName}(${JSON.stringify(event.toolArgs).slice(0, 80)})`));
        thinking.start();
        break;
      case 'tool_result':
        break;
      case 'error':
        thinking.stop();
        fishError(event.error || 'Unknown error');
        break;
      case 'done':
        thinking.stop();
        break;
    }
  });

  await runtime.run(task);
  console.log('');
  fishSuccess(`${agent.codename} completed with ${toolCalls} tool call(s)`);
}

// ─── Auto-match agent for task ──────────────────────────────────

export async function agentAuto(task: string): Promise<void> {
  const matched = matchAgentForTask(task);
  fishInfo(`Auto-matched: ${matched.emoji} ${matched.codename} (${matched.role})`);
  await agentInvoke(matched.id, task, {});
}

// ─── Register tools (shared) ────────────────────────────────────

function registerTools(): void {
  const registry = getToolRegistry();
  if (registry.getDefinitions().length > 0) return; // Already registered
  
  const { registerAllTools } = require('./chat');
  registerAllTools();
}
