#!/usr/bin/env node

/**
 * 🐟 AZERCLAW — CLI Entry Point
 * 
 * An open-source, BYOK AI agent for your terminal.
 * Inspired by OpenClaw, themed with a fish 🐟 instead of a lobster.
 * 
 * Usage:
 *   azerclaw              — Launch TUI (or onboard if first run)
 *   azerclaw chat         — Interactive chat
 *   azerclaw run "task"   — Execute a task
 *   azerclaw tui          — Premium terminal UI
 *   azerclaw onboard      — Setup wizard
 *   azerclaw config       — Manage configuration
 *   azerclaw models       — Manage AI models
 *   azerclaw doctor       — Health check
 */

const { Command } = require('commander');
const chalk = require('chalk');
const { playSplashScreen, printQuickSplash, fishError, fishInfo, fishSuccess } = require('../src/cli/animations/fish');
const { getConfigManager } = require('../src/config/manager');

const VERSION = '1.0.0';
const program = new Command();

// ─── Program Setup ──────────────────────────────────────────────

program
  .name('azerclaw')
  .description('🐟 AZERCLAW — Your AI, Your Keys, Your Way')
  .version(VERSION, '-v, --version', 'Display version')
  .option('--no-splash', 'Skip the splash screen')
  .option('--no-color', 'Disable colors');

// ─── Default Action (no command) ────────────────────────────────

program
  .action(async (opts: any) => {
    const config = getConfigManager();
    config.resolveEnvOverrides();

    if (config.isFirstRun()) {
      // First run: show full splash + onboard
      await playSplashScreen(VERSION);
      const { runOnboard } = require('../src/cli/commands/onboard');
      await runOnboard();
    } else {
      // Launch TUI by default
      const { runTUI } = require('../src/cli/commands/tui');
      await runTUI();
    }
  });

// ─── Chat Command ───────────────────────────────────────────────

program
  .command('chat')
  .description('Start an interactive chat session')
  .option('-m, --model <model>', 'Override the default model')
  .option('-p, --provider <provider>', 'Override the default provider')
  .action(async (opts: any) => {
    const config = getConfigManager();
    config.resolveEnvOverrides();
    
    if (!opts.parent?.splash === false) {
      printQuickSplash(VERSION);
    }
    
    if (config.isFirstRun()) {
      fishInfo('First time? Run `azerclaw onboard` to configure your AI providers.');
      const { runOnboard } = require('../src/cli/commands/onboard');
      await runOnboard();
      return;
    }
    
    const { runChat } = require('../src/cli/commands/chat');
    await runChat(opts);
  });

// ─── Run Command ────────────────────────────────────────────────

program
  .command('run <task>')
  .description('Execute a single task')
  .option('-m, --model <model>', 'Override the default model')
  .option('-V, --verbose', 'Show tool calls in detail')
  .action(async (task: string, opts: any) => {
    const config = getConfigManager();
    config.resolveEnvOverrides();
    printQuickSplash(VERSION);
    
    const { runTask } = require('../src/cli/commands/run');
    await runTask(task, opts);
  });

// ─── TUI Command ────────────────────────────────────────────────

program
  .command('tui')
  .description('Launch the premium terminal UI')
  .action(async () => {
    const config = getConfigManager();
    config.resolveEnvOverrides();
    
    const { runTUI } = require('../src/cli/commands/tui');
    await runTUI();
  });

// ─── Onboard Command ───────────────────────────────────────────

program
  .command('onboard')
  .description('Run the interactive setup wizard')
  .action(async () => {
    await playSplashScreen(VERSION);
    const { runOnboard } = require('../src/cli/commands/onboard');
    await runOnboard();
  });

// ─── Config Command ─────────────────────────────────────────────

const configCmd = program
  .command('config')
  .description('Manage configuration');

configCmd
  .command('get <key>')
  .description('Get a configuration value')
  .action((key: string) => {
    const { configGet } = require('../src/cli/commands/config');
    configGet(key);
  });

configCmd
  .command('set <key> <value>')
  .description('Set a configuration value')
  .action((key: string, value: string) => {
    const { configSet } = require('../src/cli/commands/config');
    configSet(key, value);
  });

configCmd
  .command('list')
  .description('Show all configuration')
  .action(() => {
    const { configList } = require('../src/cli/commands/config');
    configList();
  });

configCmd
  .command('reset')
  .description('Reset to default configuration')
  .action(() => {
    const { configReset } = require('../src/cli/commands/config');
    configReset();
  });

// Default config action (no sub-command) shows list
configCmd.action(() => {
  const { configList } = require('../src/cli/commands/config');
  configList();
});

// ─── Models Command ─────────────────────────────────────────────

const modelsCmd = program
  .command('models')
  .description('Manage AI models');

modelsCmd
  .command('list')
  .description('List all available models')
  .action(async () => {
    const { modelsList } = require('../src/cli/commands/models');
    await modelsList();
  });

modelsCmd
  .command('status')
  .description('Show current model status')
  .action(async () => {
    const { modelsStatus } = require('../src/cli/commands/models');
    await modelsStatus();
  });

modelsCmd.action(async () => {
  const { modelsStatus } = require('../src/cli/commands/models');
  await modelsStatus();
});

// ─── Doctor Command ─────────────────────────────────────────────

program
  .command('doctor')
  .description('Run health checks on your AZERCLAW installation')
  .option('-f, --fix', 'Attempt to auto-fix issues')
  .action(async (opts: any) => {
    printQuickSplash(VERSION);
    const { runDoctor } = require('../src/cli/commands/doctor');
    await runDoctor(opts);
  });

// ─── Security Audit Command ────────────────────────────────────

program
  .command('security')
  .description('Security audit')
  .command('audit')
  .option('-f, --fix', 'Auto-fix security issues')
  .action(async (opts: any) => {
    printQuickSplash(VERSION);
    fishInfo('Running security audit...');
    
    const fs = require('fs');
    const config = getConfigManager();
    const issues: string[] = [];
    
    // Check config file permissions
    try {
      const stats = fs.statSync(config.paths.configFile);
      const mode = (stats.mode & 0o777).toString(8);
      if (mode !== '600') {
        issues.push(`Config file has permissions 0${mode} (should be 0600)`);
        if (opts.fix) {
          fs.chmodSync(config.paths.configFile, 0o600);
          fishInfo('Fixed: Config permissions set to 0600');
        }
      }
    } catch { /* skip */ }
    
    // Check for keys in environment
    const envKeys = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY'];
    for (const key of envKeys) {
      if (process.env[key]) {
        fishInfo(`${key} found in environment (normal for CI/CD, prefer config file for local use)`);
      }
    }
    
    if (issues.length === 0) {
      const { fishSuccess } = require('../src/cli/animations/fish');
      fishSuccess('Security audit passed! 🔒');
    } else {
      for (const issue of issues) {
        const { fishWarn } = require('../src/cli/animations/fish');
        fishWarn(issue);
      }
    }
  });

// ─── Agents Command ─────────────────────────────────────────────

const agentsCmd = program
  .command('agents')
  .description('Manage the Pantheon of built-in agents');

agentsCmd
  .command('list')
  .description('List all available agents')
  .action(() => {
    const { agentsList } = require('../src/cli/commands/agents');
    agentsList();
  });

agentsCmd
  .command('invoke <name> <task>')
  .description('Invoke a specific agent')
  .action(async (name: string, task: string, opts: any) => {
    printQuickSplash(VERSION);
    const { agentInvoke } = require('../src/cli/commands/agents');
    await agentInvoke(name, task, opts);
  });

agentsCmd
  .command('auto <task>')
  .description('Auto-match the best agent for a task')
  .action(async (task: string) => {
    printQuickSplash(VERSION);
    const { agentAuto } = require('../src/cli/commands/agents');
    await agentAuto(task);
  });

agentsCmd.action(() => {
  const { agentsList } = require('../src/cli/commands/agents');
  agentsList();
});

// ─── Workflow Command ───────────────────────────────────────────

const workflowCmd = program
  .command('workflow')
  .description('Manage and run Fishbone workflows');

workflowCmd
  .command('run <file>')
  .description('Run a .fishbone workflow file')
  .action(async (file: string) => {
    printQuickSplash(VERSION);
    const { parseFishboneFile, FishboneEngine } = require('../src/workflow/engine');
    const path = require('path');
    const fs = require('fs');
    
    const filePath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      fishError(`Workflow file not found: ${filePath}`);
      return;
    }
    
    const workflow = parseFishboneFile(filePath);
    fishInfo(`Running workflow: ${workflow.name} (v${workflow.version})`);
    
    const engine = new FishboneEngine();
    await engine.execute(workflow, {}, async (event: any) => {
      if (event.type === 'step_start') console.log(chalk.hex('#60a5fa')(`[Step] ${event.stepName}...`));
      if (event.type === 'approval_needed') {
        console.log(chalk.hex('#fbbf24')(`[Approval] Needed for: ${event.content}`));
        console.log(chalk.hex('#34d399')(`Resume token: ${event.resumeToken}`));
      }
      if (event.type === 'step_error') console.log(chalk.hex('#ef4444')(`[Error] ${event.content}`));
      if (event.type === 'workflow_complete') fishSuccess('Workflow completed successfully');
      if (event.type === 'workflow_error') fishError(`Workflow failed: ${event.content}`);
    });
  });

workflowCmd
  .command('resume <id> <token>')
  .description('Resume a paused workflow')
  .action(async (id: string, token: string) => {
    printQuickSplash(VERSION);
    const { FishboneEngine } = require('../src/workflow/engine');
    // Note: In a real system, the engine state needs to be persisted to resume across process boundaries.
    // For now, this invokes the API.
    const engine = new FishboneEngine();
    const resumed = await engine.resume(id, token);
    if (resumed) {
      fishSuccess(`Workflow ${id} resumed successfully.`);
    } else {
      fishError(`Failed to resume workflow ${id}. Invalid token or session not found.`);
    }
  });

// ─── Parse & Run ────────────────────────────────────────────────

program.parse(process.argv);
