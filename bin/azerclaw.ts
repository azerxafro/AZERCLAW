#!/usr/bin/env node

process.removeAllListeners('warning');
process.env.NODE_NO_WARNINGS = '1';

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
 *   azerclaw config channels  — DM policy + routing controls
 *   azerclaw config sandbox   — Session sandbox controls
 *   azerclaw pairing          — Manage DM pairing approvals
 *   azerclaw init             — Initialize project (AZERCLAW.md)
 *   azerclaw models           — Manage AI models
 *   azerclaw doctor           — Health check
 *   azerclaw status           — Show current status
 */

const { Command } = require('commander');
const chalk = require('chalk');

// Disable colors and animations if output is piped
if (!process.stdout.isTTY) {
  chalk.level = 0;
  process.env.FORCE_COLOR = '0';
}

const { playSplashScreen, printQuickSplash, fishError, fishInfo, fishSuccess } = require('../src/cli/animations/fish');
const { getConfigManager } = require('../src/config/manager');

const VERSION = '2.2.0';
const program = new Command();

// ─── Program Setup ──────────────────────────────────────────────

program
  .name('azerclaw')
  .description('🐟 AZERCLAW v2.2.0 — Diabolical AI · Scorched Earth · Your Way')
  .version(VERSION, '-v, --version', 'Display version')
  .option('--no-splash', 'Skip the splash screen')
  .option('--no-color', 'Disable colors')
  .hook('preAction', async (thisCommand: any) => {
    if (thisCommand.opts().color === false) {
      chalk.level = 0;
      process.env.FORCE_COLOR = '0';
    }
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
      const input: string = await new Promise((resolve) => {
        let data = '';
        process.stdin.setEncoding('utf-8');
        process.stdin.on('data', (chunk: string) => { data += chunk; });
        process.stdin.on('end', () => resolve(data));
        process.stdin.on('error', () => resolve(data));
        // Safety timeout: prevent hanging if stdin is open but never sends EOF
        setTimeout(() => { process.stdin.pause(); resolve(data); }, 1000);
        process.stdin.resume();
      });
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
    
    if (program.opts().splash !== false) {
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
      finalTask = await new Promise((resolve) => {
        let data = '';
        process.stdin.setEncoding('utf-8');
        process.stdin.on('data', (chunk: string) => { data += chunk; });
        process.stdin.on('end', () => resolve(data));
        process.stdin.on('error', () => resolve(data));
        // Safety timeout: prevent hanging if stdin is open but never sends EOF
        setTimeout(() => { process.stdin.pause(); resolve(data); }, 1000);
        process.stdin.resume();
      });
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

program
  .command('version')
  .description('Display version information')
  .action(() => {
    console.log(`AZERCLAW v${VERSION} — Diabolical Edition`);
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

const configChannelsCmd = configCmd
  .command('channels')
  .description('Manage channel DM policy, allowlists, and session routing');

configChannelsCmd
  .command('list')
  .description('Show channel DM policy and routing config')
  .action(() => {
    const { channelsConfigList } = require('../src/cli/commands/channels');
    channelsConfigList();
  });

configChannelsCmd
  .command('dm-policy <platform> <policy>')
  .description('Set dmPolicy for a channel platform (pairing|open|closed)')
  .action((platform: string, policy: string) => {
    const { setChannelDmPolicy } = require('../src/cli/commands/channels');
    setChannelDmPolicy(platform, policy);
  });

const configChannelsAllowCmd = configChannelsCmd
  .command('allow')
  .description('Manage channel allowFrom list');

configChannelsAllowCmd
  .command('list <platform>')
  .description('List allowFrom entries for a platform')
  .action((platform: string) => {
    const { listChannelAllowFrom } = require('../src/cli/commands/channels');
    listChannelAllowFrom(platform);
  });

configChannelsAllowCmd
  .command('add <platform> <senderId>')
  .description('Add senderId to allowFrom')
  .action((platform: string, senderId: string) => {
    const { addChannelAllowFrom } = require('../src/cli/commands/channels');
    addChannelAllowFrom(platform, senderId);
  });

configChannelsAllowCmd
  .command('remove <platform> <senderId>')
  .description('Remove senderId from allowFrom')
  .action((platform: string, senderId: string) => {
    const { removeChannelAllowFrom } = require('../src/cli/commands/channels');
    removeChannelAllowFrom(platform, senderId);
  });

const configChannelsRoutingCmd = configChannelsCmd
  .command('routing')
  .description('Manage channel session routing rules');

configChannelsRoutingCmd
  .command('strategy <strategy>')
  .description('Set routing strategy (channel|platform_channel|platform_sender)')
  .action((strategy: string) => {
    const { setRoutingStrategy } = require('../src/cli/commands/channels');
    setRoutingStrategy(strategy);
  });

configChannelsRoutingCmd
  .command('add <sessionId>')
  .description('Add routing rule')
  .option('--platform <platform>', 'Platform matcher')
  .option('--channel <channelId>', 'Channel matcher')
  .option('--sender <senderId>', 'Sender matcher')
  .action((sessionId: string, opts: any) => {
    const { addRoutingRule } = require('../src/cli/commands/channels');
    addRoutingRule(sessionId, { platform: opts.platform, channel: opts.channel, sender: opts.sender });
  });

configChannelsRoutingCmd
  .command('remove <sessionId>')
  .description('Remove routing rule(s) for sessionId and optional matchers')
  .option('--platform <platform>', 'Platform matcher')
  .option('--channel <channelId>', 'Channel matcher')
  .option('--sender <senderId>', 'Sender matcher')
  .action((sessionId: string, opts: any) => {
    const { removeRoutingRule } = require('../src/cli/commands/channels');
    removeRoutingRule(sessionId, { platform: opts.platform, channel: opts.channel, sender: opts.sender });
  });

configChannelsRoutingCmd
  .command('list')
  .description('List DM policy and routing settings')
  .action(() => {
    const { channelsConfigList } = require('../src/cli/commands/channels');
    channelsConfigList();
  });

const configSandboxCmd = configCmd
  .command('sandbox')
  .description('Manage session sandbox isolation');

configSandboxCmd
  .command('status')
  .description('Show sandbox mode and tool policy')
  .action(() => {
    const { sandboxStatus } = require('../src/cli/commands/sandbox');
    sandboxStatus();
  });

configSandboxCmd
  .command('mode <mode>')
  .description('Set sandbox mode (off|non-main|all)')
  .action((mode: string) => {
    const { setSandboxMode } = require('../src/cli/commands/sandbox');
    setSandboxMode(mode);
  });

const configSandboxAllowCmd = configSandboxCmd
  .command('allow')
  .description('Manage sandbox allowed tool list');

configSandboxAllowCmd
  .command('add <toolName>')
  .description('Add allowed tool')
  .action((toolName: string) => {
    const { addSandboxAllowedTool } = require('../src/cli/commands/sandbox');
    addSandboxAllowedTool(toolName);
  });

configSandboxAllowCmd
  .command('remove <toolName>')
  .description('Remove allowed tool')
  .action((toolName: string) => {
    const { removeSandboxAllowedTool } = require('../src/cli/commands/sandbox');
    removeSandboxAllowedTool(toolName);
  });

const configSandboxDenyCmd = configSandboxCmd
  .command('deny')
  .description('Manage sandbox denied tool list');

configSandboxDenyCmd
  .command('add <toolName>')
  .description('Add denied tool')
  .action((toolName: string) => {
    const { addSandboxDeniedTool } = require('../src/cli/commands/sandbox');
    addSandboxDeniedTool(toolName);
  });

configSandboxDenyCmd
  .command('remove <toolName>')
  .description('Remove denied tool')
  .action((toolName: string) => {
    const { removeSandboxDeniedTool } = require('../src/cli/commands/sandbox');
    removeSandboxDeniedTool(toolName);
  });

configSandboxCmd.action(() => {
  const { sandboxStatus } = require('../src/cli/commands/sandbox');
  sandboxStatus();
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

// ─── Update Command ─────────────────────────────────────────────

program
  .command('update')
  .description('Upgrade AZERCLAW to the latest version')
  .action(async () => {
    printQuickSplash(VERSION);
    const chalk = require('chalk');
    const { fishInfo, fishSuccess, fishError } = require('../src/cli/animations/fish');
    
    fishInfo('Initiating scorched-earth update... 🐟🔥');
    
    const { execSync } = require('child_process');
    try {
      fishInfo('Executing global installation via npm...');
      // stdio: inherit allows the user to see the npm progress bar and output
      execSync('npm install -g azerclaw@latest', { stdio: 'inherit' });
      fishSuccess('AZERCLAW upgraded to the latest version successfully!');
      console.log(chalk.dim('Please restart your terminal if you encounter any path issues.\n'));
    } catch (e: any) {
      fishError(`Update failed: ${e.message}`);
      console.log(chalk.dim('\nTip: You may need to run this with sudo depending on your npm configuration:'));
      console.log(chalk.yellow('sudo npm install -g azerclaw@latest\n'));
    }
  });


// ─── Security Audit Command ────────────────────────────────────

const securityCmd = program
  .command('security')
  .description('Security audit');

securityCmd
  .command('audit')
  .option('-f, --fix', 'Auto-fix security issues')
  .action(async (opts: any) => {
    printQuickSplash(VERSION);
    fishInfo('Running security audit...');
    
    const fs = require('fs');
    const config = getConfigManager();
    const { auditDmPolicies, applySafeDmDefaults } = require('../src/channels/security');
    const { auditSandboxPosture, applySafeSandboxDefaults } = require('../src/core/sandbox');
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

    const dmAudit = auditDmPolicies(config.getAll().channels);
    for (const issue of dmAudit.failures) {
      issues.push(issue.message);
    }
    for (const issue of dmAudit.warnings) {
      issues.push(issue.message);
    }

    if (opts.fix && dmAudit.failures.length > 0) {
      const changes = applySafeDmDefaults(config);
      for (const change of changes) {
        fishInfo(`Fixed: ${change}`);
      }
    }

    const sandboxAudit = auditSandboxPosture(config.getAll());
    for (const issue of sandboxAudit.failures) {
      issues.push(issue.message);
    }
    for (const issue of sandboxAudit.warnings) {
      issues.push(issue.message);
    }

    if (opts.fix && sandboxAudit.failures.length > 0) {
      const changes = applySafeSandboxDefaults(config);
      for (const change of changes) {
        fishInfo(`Fixed: ${change}`);
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

// ─── Pairing Command ──────────────────────────────────────────────

const pairingCmd = program
  .command('pairing')
  .description('Manage DM pairing approvals for channel adapters');

pairingCmd
  .command('list')
  .description('List approved pairings')
  .option('--pending', 'Include pending pairing requests')
  .option('-p, --platform <platform>', 'Filter by platform')
  .action((opts: any) => {
    const { pairingList } = require('../src/cli/commands/pairing');
    pairingList({ pending: opts.pending, platform: opts.platform });
  });

pairingCmd
  .command('approve <platform> <code>')
  .description('Approve a pending pairing code')
  .action((platform: string, code: string) => {
    const { pairingApprove } = require('../src/cli/commands/pairing');
    pairingApprove(platform, code);
  });

pairingCmd
  .command('revoke <platform> <senderId>')
  .description('Revoke an approved sender pairing')
  .action((platform: string, senderId: string) => {
    const { pairingRevoke } = require('../src/cli/commands/pairing');
    pairingRevoke(platform, senderId);
  });

pairingCmd.action(() => {
  const { pairingList } = require('../src/cli/commands/pairing');
  pairingList({ pending: true });
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

// ─── Bot Command ─────────────────────────────────────────────

const botCmd = program
  .command('bot')
  .description('Manage messenger bots (Telegram, Discord, Slack)');

botCmd
  .command('start')
  .description('Start all enabled bot channels')
  .option('-p, --port <port>', 'Gateway port', '3142')
  .action(async (opts: any) => {
    const { startBot } = require('../src/cli/commands/bot');
    await startBot({ port: parseInt(opts.port, 10) });
  });

// ─── Export Command ─────────────────────────────────────────────

program
  .command('export [sessionId]')
  .description('Export a session as a professional PDF Mission Debrief')
  .action(async (sessionId: string | undefined) => {
    const { runExport } = require('../src/cli/commands/export');
    await runExport(sessionId);
  });

// ─── Share Command ──────────────────────────────────────────────

program
  .command('share [sessionId]')
  .description('Export a session as a shareable markdown file')
  .action(async (sessionId: string | undefined) => {
    const { runShare } = require('../src/cli/commands/share');
    await runShare(sessionId);
  });

// ─── Plugin Commands ───────────────────────────────────────────

const plugins = program.command('plugin')
  .description('Manage community plugins');

plugins.command('list')
  .description('List available community plugins')
  .action(async () => {
    const { listPlugins } = require('../src/cli/commands/plugins');
    await listPlugins();
  });

plugins.command('install <name>')
  .description('Install a community plugin')
  .action(async (name: string) => {
    const { installPlugin } = require('../src/cli/commands/plugins');
    await installPlugin(name);
  });

// ─── MCP Commands ──────────────────────────────────────────────

const mcp = program.command('mcp')
  .description('Manage Model Context Protocol (MCP) servers');

mcp.command('list')
  .description('List available MCP servers from the directory')
  .action(async () => {
    const { listMCPDirectory } = require('../src/cli/commands/mcp');
    await listMCPDirectory();
  });

mcp.command('add <name>')
  .description('Add an MCP server from the directory')
  .action(async (name: string) => {
    const { addMCPServer } = require('../src/cli/commands/mcp');
    await addMCPServer(name);
  });

mcp.command('remove <name>')
  .description('Remove an MCP server')
  .action(async (name: string) => {
    const { removeMCPServer } = require('../src/cli/commands/mcp');
    await removeMCPServer(name);
  });

// ─── Parse & Run ────────────────────────────────────────────────


program.parse(process.argv);
