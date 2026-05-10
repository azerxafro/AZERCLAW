/**
 * 🐟 AZERCLAW Plugin Marketplace
 * Manage community-built tools and extensions.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
const { fishBox, fishSuccess, fishError, fishInfo, fishWarn } = require('../animations/fish');

const PLUGINS_DIR = path.join(os.homedir(), '.azerclaw', 'plugins');

// Curated Community Plugins
const COMMUNITY_PLUGINS = [
  {
    name: 'vought-security',
    description: 'Deep security scanner for Node.js apps',
    author: 'BlackNoir',
    url: 'https://raw.githubusercontent.com/azerclaw/community-plugins/main/vought-security.js'
  },
  {
    name: 'fish-vision',
    description: 'Terminal image viewer for generated evidence',
    author: 'TheDeep',
    url: 'https://raw.githubusercontent.com/azerclaw/community-plugins/main/fish-vision.js'
  },
  {
    name: 'mission-timer',
    description: 'Adds time-tracking and estimation to tasks',
    author: 'Butcher',
    url: 'https://raw.githubusercontent.com/azerclaw/community-plugins/main/mission-timer.js'
  }
];

export async function listPlugins(): Promise<void> {
  if (!fs.existsSync(PLUGINS_DIR)) {
    fs.mkdirSync(PLUGINS_DIR, { recursive: true });
  }

  const installed = fs.readdirSync(PLUGINS_DIR).map(f => path.basename(f, '.js'));

  console.log('');
  fishBox('🐟 PLUGIN MARKETPLACE', [
    chalk.dim('  Install community-built tools for Compound V.'),
    '',
    ...COMMUNITY_PLUGINS.map(p => {
      const isInstalled = installed.includes(p.name) ? chalk.green(' [Installed]') : chalk.dim(' [Not installed]');
      return `  ${chalk.bold(p.name.padEnd(20))} ${isInstalled}\n    ${chalk.dim(p.description)} (${p.author})`;
    }),
    '',
    chalk.dim('  Usage: azerclaw plugin install <name>'),
  ]);
  console.log('');
}

export async function installPlugin(name: string): Promise<void> {
  const plugin = COMMUNITY_PLUGINS.find(p => p.name === name);
  if (!plugin) {
    fishError(`Plugin "${name}" not found in marketplace.`);
    return;
  }

  if (!fs.existsSync(PLUGINS_DIR)) {
    fs.mkdirSync(PLUGINS_DIR, { recursive: true });
  }

  const targetPath = path.join(PLUGINS_DIR, `${plugin.name}.js`);
  
  fishInfo(`Downloading ${plugin.name} from Compound V servers...`);

  try {
    const fetch = require('node-fetch');
    const response = await fetch(plugin.url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const code = await response.text();
    fs.writeFileSync(targetPath, code);
    
    fishSuccess(`Plugin "${plugin.name}" installed successfully.`);
    fishInfo(`Restart AZERCLAW to activate new tools.`);
  } catch (error: any) {
    fishError(`Failed to install plugin: ${error.message}`);
    // Create a mock file for demo if real fetch fails
    const mockCode = `
      module.exports = {
        name: '${plugin.name}',
        description: '${plugin.description}',
        version: '1.0.0',
        author: '${plugin.author}',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ success: true, output: 'Community plugin ${plugin.name} active.' })
      };
    `;
    fs.writeFileSync(targetPath, mockCode);
    fishWarn(`Server unreachable. Created local placeholder for "${plugin.name}".`);
  }
}
