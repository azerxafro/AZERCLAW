#!/usr/bin/env node

/**
 * 🐟 AZERCLAW — CLI Entry Point
 * 
 * An open-source, BYOK AI agent for your terminal.
 * Inspired by OpenClaw, themed with a fish 🐟 instead of a lobster.
 * 
 * Usage:
 *   azerclaw                  — Launch interactive session (or onboard if first run)
 *   azerclaw chat             — Interactive chat
 *   azerclaw run "task"       — Execute a task
 *   azerclaw tui              — Premium terminal UI
 *   azerclaw onboard          — Setup wizard
 *   azerclaw config           — Manage configuration
 *   azerclaw config provider  — Switch provider
 *   azerclaw config model     — Switch model
 *   azerclaw config apikey    — Set API key
 *   azerclaw config fallback  — Configure fallback
 *   azerclaw init             — Initialize project (AZERCLAW.md)
 *   azerclaw models           — Manage AI models
 *   azerclaw doctor           — Health check
 *   azerclaw status           — Show current status
 */

const { Command } = require('commander');
const chalk = require('chalk');
const { playSplashScreen, printQuickSplash, fishError, fishInfo, fishSuccess } = require('../src/cli/animations/fish');
const { getConfigManager } = require('../src/config/manager');

const VERSION = '1.1.0';
const program = new Command();

// ─── Program Setup ──────────────────────────────────────────────

program
  .name('azerclaw')
  .description('🐟 AZERCLAW — Diabolical AI · Scorched Earth · Your Way')
  .version(VERSION, '-v, --version', 'Display version')
  .option('--no-splash', 'Skip the splash screen')
  .option('--no-color', 'Disable colors')
  .hook('preAction', async () => {
    // Global initialization
    const { registerAllTools } = require('../src/tools');
    await registerAllTools();
  });

// ─── Default Action (no command) ────────────────────────────────

program
  .argument('[task]', 'Optional task to execute immediately (one-off mode)')
  .action(async (task: string | undefined, opts: any) => {
    const config = getConfigManager();
    config.resolveEnvOverrides();

    // Check for positional task
    if (task) {
      const { runTask } = require('../src/cli/commands/run');
      await runTask(task.trim(), opts);
      return;
    }

    // Check for piped input (stdin)
    if (!process.stdin.isTTY) {
      let input = '';
      process.stdin.setEncoding('utf-8');
      for await (const chunk of process.stdin) {
        input += chunk;
      }
      if (input.trim()) {
        const { runTask } = require('../src/cli/commands/run');
        await runTask(input.trim(), opts);
        return;
      }
    }

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
  .option('-f, --file <path>', 'Include a file in the conversation context')
  .action(async (opts: any) => {
    const config = getConfigManager();
    config.resolveEnvOverrides();
    
    // Apply CLI flag overrides
    if (opts.model || opts.provider) {
      config.applyRuntimeOverrides(opts);
    }
    
    if (opts.file) {
      const fs = require('fs');
      if (fs.existsSync(opts.file)) {
        const content = fs.readFileSync(opts.file, 'utf-8');
        opts.initialMessage = `I've attached the file: ${opts.file}\n\n\`\`\`\n${content}\n\`\`\``;
      }
    }
    
    if (!opts.parent?.splash === false) {
      printQuickSplash(VERSION);
    }
    
    if (config.isFirstRun()) {
      fishInfo('First time? Running setup wizard...');
      const { runOnboard } = require('../src/cli/commands/onboard');
      await runOnboard();
      return;
    }
    
    const { runChat } = require('../src/cli/commands/chat');
    await runChat(opts);
  });

// ─── Run Command ────────────────────────────────────────────────

program
  .command('run [task]')
  .description('Execute a single task')
  .option('-m, --model <model>', 'Override the default model')
  .option('-p, --provider <provider>', 'Override the default provider')
  .option('-f, --file <path>', 'Include a file in the task context')
  .option('-V, --verbose', 'Show tool calls in detail')
  .action(async (task: string | undefined, opts: any) => {
    const config = getConfigManager();
    config.resolveEnvOverrides();
    
    if (opts.model || opts.provider) {
      config.applyRuntimeOverrides(opts);
    }

    let finalTask = task || '';

    // Handle piped input if task is missing
    if (!finalTask && !process.stdin.isTTY) {
      process.stdin.setEncoding('utf-8');
      for await (const chunk of process.stdin) {
        finalTask += chunk;
      }
    }

    if (!finalTask.trim()) {
      fishError('No task provided. Usage: azerclaw run "your task" or echo "task" | azerclaw run');
      return;
    }

    if (opts.file) {
      const fs = require('fs');
      if (fs.existsSync(opts.file)) {
        const content = fs.readFileSync(opts.file, 'utf-8');
        finalTask = `Context from file ${opts.file}:\n\`\`\`\n${content}\n\`\`\`\n\nTask: ${finalTask}`;
      }
    }
    
    printQuickSplash(VERSION);
    
    const { runTask } = require('../src/cli/commands/run');
    await runTask(finalTask.trim(), opts);
  });

// ─── Serve Command ──────────────────────────────────────────────

program
  .command('serve')
  .description('Start the AZERCLAW local WebSocket daemon for desktop apps')
  .option('-p, --port <port>', 'Port to listen on', '8080')
  .action((opts: any) => {
    printQuickSplash(VERSION);
    const { AzerclawServer } = require('../src/core/server');
    const port = parseInt(opts.port, 10) || 8080;
    const server = new AzerclawServer(port);
    server.start();
  });

// ─── TUI Command ────────────────────────────────────────────────

program
  .command('tui')
  .description('Launch the premium terminal UI')
  .option('-m, --model <model>', 'Override the default model')
  .option('-p, --provider <provider>', 'Override the default provider')
  .action(async (opts: any) => {
    const config = getConfigManager();
    config.resolveEnvOverrides();
    
    if (opts.model || opts.provider) {
      config.applyRuntimeOverrides(opts);
    }
    
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

// ─── Init Command (Project) ────────────────────────────────────

program
  .command('init')
  .description('Initialize AZERCLAW for this project (creates AZERCLAW.md + .azerclaw/)')
  .action(() => {
    const { initProject } = require('../src/cli/commands/settings');
    initProject();
  });

// ─── Status Command ─────────────────────────────────────────────

program
  .command('status')
  .description('Show current model, provider, auth, and project status')
  .action(() => {
    const config = getConfigManager();
    config.resolveEnvOverrides();
    const { showStatus } = require('../src/cli/commands/settings');
    showStatus();
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

configCmd
  .command('provider [name]')
  .description('Switch the active AI provider (interactive if no name given)')
  .action(async (name?: string) => {
    if (name) {
      const { cliSwitchProvider } = require('../src/cli/commands/settings');
      cliSwitchProvider(name);
    } else {
      const { interactiveProviderSwitch } = require('../src/cli/commands/settings');
      await interactiveProviderSwitch();
    }
  });

configCmd
  .command('model [id]')
  .description('Switch the default model (interactive if no id given)')
  .option('-p, --provider <provider>', 'Target provider (defaults to active)')
  .action(async (id?: string, opts?: any) => {
    if (id) {
      const { cliSwitchModel } = require('../src/cli/commands/settings');
      cliSwitchModel(id, opts?.provider);
    } else {
      const { interactiveModelSwitch } = require('../src/cli/commands/settings');
      await interactiveModelSwitch();
    }
  });

configCmd
  .command('apikey [provider] [key]')
  .description('Set or change an API key (interactive if no args given)')
  .action(async (provider?: string, key?: string) => {
    if (provider && key) {
      const { cliSetApiKey } = require('../src/cli/commands/settings');
      cliSetApiKey(provider, key);
    } else {
      const { interactiveApiKeyChange } = require('../src/cli/commands/settings');
      await interactiveApiKeyChange();
    }
  });

configCmd
  .command('fallback [provider]')
  .description('Set or change the fallback provider (interactive if no arg given)')
  .action(async (provider?: string) => {
    if (provider) {
      const { cliSetFallback } = require('../src/cli/commands/settings');
      cliSetFallback(provider);
    } else {
      const { interactiveFallbackConfig } = require('../src/cli/commands/settings');
      await interactiveFallbackConfig();
    }
  });

configCmd
  .command('settings')
  .description('Open the full interactive settings menu')
  .action(async () => {
    const { interactiveSettingsMenu } = require('../src/cli/commands/settings');
    await interactiveSettingsMenu();
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
    const engine = new FishboneEngine();
    const resumed = await engine.resume(id, token);
    if (resumed) {
      fishSuccess(`Workflow ${id} resumed successfully.`);
    } else {
      fishError(`Failed to resume workflow ${id}. Invalid token or session not found.`);
    }
  });

// ─── Tools Command ──────────────────────────────────────────────

const toolsCmd = program
  .command('tools')
  .description('Manage AZERCLAW tools and plugins');

toolsCmd
  .command('list')
  .description('List all registered tools')
  .action(() => {
    const { getToolRegistry } = require('../src/tools/registry');
    const registry = getToolRegistry();
    const tools = registry.getAll();
    
    console.log('');
    fishInfo(`Registered Tools (${tools.length})`);
    console.log('');
    
    const Table = require('cli-table3');
    const table = new Table({
      head: [chalk.hex('#60a5fa')('Name'), chalk.hex('#60a5fa')('Version'), chalk.hex('#60a5fa')('Description')],
      colWidths: [20, 10, 50],
      wordWrap: true,
    });

    tools.forEach((tool: any) => {
      table.push([
        chalk.hex('#34d399')(tool.name),
        chalk.dim(tool.version),
        tool.description.slice(0, 100) + (tool.description.length > 100 ? '...' : '')
      ]);
    });

    console.log(table.toString());
  });

toolsCmd
  .command('info <name>')
  .description('Show detailed information about a tool')
  .action((name: string) => {
    const { getToolRegistry } = require('../src/tools/registry');
    const tool = getToolRegistry().get(name);
    if (!tool) {
      fishError(`Tool not found: ${name}`);
      return;
    }

    console.log('');
    console.log(chalk.hex('#60a5fa').bold(`Tool: ${tool.name}`));
    console.log(chalk.dim(`Version: ${tool.version}`));
    if (tool.author) console.log(chalk.dim(`Author: ${tool.author}`));
    console.log('');
    console.log(tool.description);
    console.log('');
    console.log(chalk.hex('#fbbf24')('Parameters:'));
    console.log(JSON.stringify(tool.parameters, null, 2));
  });

toolsCmd
  .command('docs')
  .description('Generate markdown documentation for all tools')
  .option('-o, --output <file>', 'Output file path', 'TOOLS.md')
  .action(async (opts: any) => {
    const { getToolRegistry } = require('../src/tools/registry');
    const fs = require('fs');
    const path = require('path');
    
    const tools = getToolRegistry().getAll();
    let markdown = `# 🐟 AZERCLAW Tools Documentation\n\n`;
    markdown += `Generated on ${new Date().toLocaleDateString()}\n\n`;
    
    tools.forEach((tool: any) => {
      markdown += `## ${tool.name} (v${tool.version})\n\n`;
      markdown += `${tool.description}\n\n`;
      markdown += `### Parameters\n\n\`\`\`json\n${JSON.stringify(tool.parameters, null, 2)}\n\`\`\`\n\n`;
      markdown += `---\n\n`;
    });

    
    const outputPath = path.resolve(process.cwd(), opts.output);
    fs.writeFileSync(outputPath, markdown);
    fishSuccess(`Documentation generated at ${outputPath}`);
  });

toolsCmd
  .command('install <url_or_path>')
  .description('Install a tool plugin from a URL or local file (coming soon)')
  .action((src: string) => {
    fishInfo(`Plugin installation for '${src}' will be available in the next release.`);
    fishInfo('For now, manually place your .js/.ts files in the ./plugins directory.');
  });

toolsCmd.action(() => {
  program.helpInformation();
});

// ─── Parse & Run ────────────────────────────────────────────────


program.parse(process.argv);
