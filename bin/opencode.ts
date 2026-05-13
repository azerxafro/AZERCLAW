#!/usr/bin/env node

/**
 * 🔷 OPENCODE — Premium AI Server Gateway
 * 
 * This is a specialized entry point for the Opencode brand.
 * By default, it launches the AZERCLAW WebSocket daemon (serve).
 * 
 * Usage:
 *   opencode --port 20220
 *   opencode chat
 *   opencode tui
 */

import { Command } from 'commander';
import { AzerclawServer } from '../src/core/server';
import { printQuickSplash } from '../src/cli/animations/fish';

export async function runOpencode() {
  const VERSION = '2.1.8';
  const program = new Command();

  program
    .name('opencode')
    .description('🔷 OPENCODE — Premium AI Server Gateway')
    .version(VERSION)
    .option('-p, --port <port>', 'Port to listen on', '8080')
    .action((opts: any) => {
      // Default action is to start the server
      printQuickSplash(VERSION);
      const port = parseInt(opts.port, 10) || 8080;
      const server = new AzerclawServer(port);
      server.start();
    });

  // Also allow standard azerclaw commands through this alias if needed
  program
    .command('chat')
    .description('Start an interactive chat session')
    .action(async () => {
      const { runChat } = require('../src/cli/commands/chat');
      await runChat({});
    });

  program
    .command('tui')
    .description('Launch the premium terminal UI')
    .action(async () => {
      const { runTUI } = require('../src/cli/commands/tui');
      await runTUI();
    });

  program.parse(process.argv);
}

if (require.main === module) {
  runOpencode().catch(console.error);
}

