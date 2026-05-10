/**
 * 🐟 AZERCLAW Tool System
 * Central entry point for all tools and registration.
 */

import { getToolRegistry } from './registry';
import { getToolLoader } from './loader';
import { shellTool } from './shell';
import { readFileTool, writeFileTool, listDirTool, searchFilesTool } from './filesystem';
import { spawnSubAgentTool, webSearchTool, codeAnalysisTool } from './advanced';
import { reverseEngineerTool, stealthAuditTool, patternSpotterTool } from './specialized';
import { generateImageTool } from './visual';
import { memoryTool } from './memory';
import { getMCPManager } from './mcp';
import * as path from 'path';
import * as os from 'os';

/**
 * Register all built-in tools and load external plugins.
 */
export async function registerAllTools(): Promise<void> {
  const registry = getToolRegistry();
  
  // 1. Register Built-in Tools
  registry.register(shellTool);
  registry.register(readFileTool);
  registry.register(writeFileTool);
  registry.register(listDirTool);
  registry.register(searchFilesTool);
  registry.register(spawnSubAgentTool);
  registry.register(webSearchTool);
  registry.register(codeAnalysisTool);
  registry.register(reverseEngineerTool);
  registry.register(stealthAuditTool);
  registry.register(patternSpotterTool);
  registry.register(generateImageTool);
  registry.register(memoryTool);

  // 2. Initialize MCP Tools
  try {
    const mcp = getMCPManager();
    await mcp.initialize();
  } catch (error: any) {
    console.warn(`[MCP] Failed to initialize: ${error.message}`);
  }

  // 3. Load External Plugins
  const loader = getToolLoader();
  
  // Standard plugin locations
  const pluginPaths = [
    path.join(process.cwd(), 'plugins'),
    path.join(os.homedir(), '.azerclaw', 'plugins')
  ];

  for (const pluginPath of pluginPaths) {
    await loader.loadFromDirectory(pluginPath);
  }
}
