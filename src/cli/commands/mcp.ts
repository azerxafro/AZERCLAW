/**
 * 🐟 AZERCLAW MCP Manager
 * CLI command to manage Model Context Protocol (MCP) servers.
 */

import chalk from 'chalk';
import { fishBox, fishSuccess, fishError, fishInfo } from '../animations/fish';
import { getConfigManager } from '../../config/manager';

// Curated list of popular MCP servers
const MCP_DIRECTORY = [
  {
    name: 'filesystem',
    description: 'Secure local file access (read, write, search)',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
  },
  {
    name: 'github',
    description: 'Manage repositories, issues, and pull requests',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    envVars: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
  },
  {
    name: 'google-drive',
    description: 'Search and read Google Drive documents',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-google-drive'],
  },
  {
    name: 'postgres',
    description: 'Read-only SQL database access',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost/mydb'],
  },
  {
    name: 'brave-search',
    description: 'Privacy-preserving web search',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    envVars: ['BRAVE_API_KEY'],
  },
  {
    name: 'puppeteer',
    description: 'Browser automation and web scraping',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
  },
  {
    name: 'fetch',
    description: 'Efficiently grab and convert web content',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
  },
  {
    name: 'antigravity',
    description: 'Remote control for Antigravity IDE (open files, sync context)',
    command: 'npm',
    args: ['run', 'mcp:antigravity'],
    env: { PWD: '/Users/Founder/Documents/Github/AZERCLAW' }
  }
];

export async function listMCPDirectory(): Promise<void> {
  const config = getConfigManager().getAll();
  const installed = config.mcpServers || {};

  console.log('');
  fishBox('🐟 MCP SERVER DIRECTORY', [
    chalk.dim('  Discover and enable Model Context Protocol servers.'),
    '',
    ...MCP_DIRECTORY.map(s => {
      const isInstalled = installed[s.name] ? chalk.green(' [Enabled]') : chalk.dim(' [Not installed]');
      return `  ${chalk.bold(s.name.padEnd(15))} ${isInstalled}\n    ${chalk.dim(s.description)}`;
    }),
    '',
    chalk.dim('  Usage: azerclaw mcp add <name>'),
  ]);
  console.log('');
}

export async function addMCPServer(name: string): Promise<void> {
  const server = MCP_DIRECTORY.find(s => s.name === name) as any;
  if (!server) {
    fishError(`Server "${name}" not found in directory. Use azerclaw mcp add-custom instead.`);
    return;
  }

  const configManager = getConfigManager();
  const mcpServers = { ...(configManager.get('mcpServers') as any || {}) };

  mcpServers[name] = {
    command: server.command,
    args: server.args,
    env: server.env || {},
    enabled: true,
  };

  configManager.set('mcpServers', mcpServers);
  fishSuccess(`MCP Server "${name}" added and enabled.`);
  
  if (server.envVars) {
    fishInfo(`Note: This server requires the following environment variables: ${server.envVars.join(', ')}`);
  }
}

export async function removeMCPServer(name: string): Promise<void> {
  const configManager = getConfigManager();
  const mcpServers = { ...(configManager.get('mcpServers') as any || {}) };

  if (!mcpServers[name]) {
    fishError(`MCP Server "${name}" is not installed.`);
    return;
  }

  delete mcpServers[name];
  configManager.set('mcpServers', mcpServers);
  fishSuccess(`MCP Server "${name}" removed.`);
}
