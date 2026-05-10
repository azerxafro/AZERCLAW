/**
 * 🐟 AZERCLAW MCP Client
 * Implements the Model Context Protocol (MCP) to connect to external tool servers.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { getToolRegistry, Tool, ToolResult } from './registry';
import { getConfigManager } from '../config/manager';

export class MCPManager {
  private clients: Map<string, Client> = new Map();
  private registry = getToolRegistry();

  /**
   * Initialize all enabled MCP servers from the configuration.
   */
  async initialize(): Promise<void> {
    const config = getConfigManager().getAll();
    const servers = config.mcpServers || {};

    for (const [name, serverConfig] of Object.entries(servers)) {
      if (!serverConfig.enabled) continue;
      
      try {
        await this.connectToServer(name, serverConfig);
      } catch (error: any) {
        console.error(`[MCP] Failed to connect to server "${name}":`, error.message);
      }
    }
  }

  /**
   * Connect to a single MCP server and register its tools.
   */
  async connectToServer(name: string, config: any): Promise<void> {
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: { ...process.env, ...(config.env || {}) },
    });

    const client = new Client(
      { name: 'Azertron-X1-Client', version: '1.0.0' },
      { capabilities: { tools: {} } } as any
    );

    await client.connect(transport);
    
    // List available tools from the server
    const { tools } = await client.listTools();
    
    for (const mcpTool of tools) {
      const toolWrapper: Tool = {
        name: mcpTool.name,
        description: mcpTool.description || `MCP Tool from ${name} server`,
        version: 'mcp-1.0.0',
        author: name,
        parameters: mcpTool.inputSchema as any,
        execute: async (args: any): Promise<ToolResult> => {
          try {
            const result = await client.callTool({
              name: mcpTool.name,
              arguments: args,
            });
            
            return {
              success: !result.isError,
              output: JSON.stringify(result.content, null, 2),
            };
          } catch (error: any) {
            return {
              success: false,
              output: `MCP Error: ${error.message}`,
              error: error.message,
            };
          }
        }
      };

      this.registry.register(toolWrapper);
    }

    this.clients.set(name, client);
    console.log(`[MCP] Connected to "${name}" and registered ${tools.length} tools.`);
  }

  async shutdown(): Promise<void> {
    for (const client of this.clients.values()) {
      try {
        await client.close();
      } catch { /* ignore */ }
    }
  }
}

let instance: MCPManager | null = null;
export function getMCPManager(): MCPManager {
  if (!instance) instance = new MCPManager();
  return instance;
}
