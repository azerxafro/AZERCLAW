/**
 * 🐟 AZERCLAW Tool Registry
 * Manages all available tools that the agent can use.
 */

import { getConfigManager } from '../config/manager';
import { resolveSandboxMode } from '../core/sandbox';

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: Record<string, unknown>; // For telemetry and self-correction hints
}

export interface ToolExecutionContext {
  agentId?: string;
  timeoutMs?: number; // Default execution timeout
  sandbox?: boolean;  // Optional per-call sandbox override
}

export interface Tool {
  name: string;
  description: string;
  version: string;
  author?: string;
  license?: string;
  tags?: string[];
  parameters: Record<string, unknown>;
  execute(args: Record<string, unknown>): Promise<ToolResult>;
}

class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private pluginTools: Map<string, string> = new Map(); // toolName -> pluginId
  private sandboxEnabled: boolean = false;

  constructor(options: { sandbox?: boolean } = {}) {
    this.sandboxEnabled = options.sandbox || false;
  }

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  registerTool(tool: Tool, pluginId?: string): void {
    this.tools.set(tool.name, tool);
    if (pluginId) {
      this.pluginTools.set(tool.name, pluginId);
    }
  }

  unregister(toolName: string): void {
    this.tools.delete(toolName);
    this.pluginTools.delete(toolName);
  }

  unregisterTool(toolName: string): void {
    this.unregister(toolName);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getPluginId(toolName: string): string | undefined {
    return this.pluginTools.get(toolName);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  getToolsByPlugin(pluginId: string): Tool[] {
    return Array.from(this.tools.values()).filter(tool => 
      this.pluginTools.get(tool.name) === pluginId
    );
  }

  getDefinitions(): any[] {
    return this.getAll().map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        author: tool.author || 'builtin',
      },
    }));
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext = {}
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      console.warn(`[ToolRegistry] Attempted to execute unknown tool: ${name}`);
      return { success: false, output: '', error: `Unknown tool: ${name}` };
    }
    
    const startTime = Date.now();
    if (process.env.AZERCLAW_DEBUG) {
      console.log(`[ToolRegistry] Executing '${name}' (v${tool.version})...`);
    }
    
    try {
      let result: ToolResult;
      const useSandbox = context.sandbox ?? this.sandboxEnabled;
      
      if (useSandbox) {
        result = await this.executeInSandbox(tool, args);
      } else {
        result = await tool.execute(args);
      }
      
      const duration = Date.now() - startTime;
      if (process.env.AZERCLAW_DEBUG) {
        console.log(`[ToolRegistry] '${name}' completed in ${duration}ms. Success: ${result.success}`);
      }
      
      // Telemetry hook (local only as per AZERCLAW policy)
      this.logTelemetry(name, duration, result.success);
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      if (process.env.AZERCLAW_DEBUG) {
        console.error(`[ToolRegistry] '${name}' failed in ${duration}ms:`, error.message);
      }
      this.logTelemetry(name, duration, false, error.message);
      return { success: false, output: '', error: error.message || 'Tool execution failed' };
    }

  }

  private async executeInSandbox(tool: Tool, args: Record<string, unknown>): Promise<ToolResult> {
    // Basic VM sandboxing
    const vm = require('vm');
    const context = {
      args,
      tool,
      console,
      Buffer,
      process: {
        env: { ...process.env, OPENAI_API_KEY: undefined, ANTHROPIC_API_KEY: undefined, GOOGLE_API_KEY: undefined }
      },
      result: { success: false, output: '' } as ToolResult
    };
    
    vm.createContext(context);
    const code = `
      (async () => {
        try {
          result = await tool.execute(args);
        } catch (e) {
          result = { success: false, output: '', error: e.message };
        }
      })()
    `;
    
    await vm.runInContext(code, context);
    return context.result;
  }

  private logTelemetry(toolName: string, duration: number, success: boolean, error?: string): void {
    // AZERCLAW keeps telemetry local. We could write to a local log file or store in memory.
    // For now, we'll just use a simple audit log style.
    const { auditLog } = require('../core/security');
    auditLog('TOOL_EXECUTION', `${toolName} | ${duration}ms | ${success ? 'SUCCESS' : 'FAILURE'}${error ? ` | ${error}` : ''}`);
  }
}

let instance: ToolRegistry | null = null;
let creating = false;
export function getToolRegistry(): ToolRegistry {
  if (!instance) {
    if (creating) {
      // Re-entrant call during construction — eagerly publish a partially-built
      // singleton so callers share the same registry instead of getting a bare empty one.
      instance = new ToolRegistry({ sandbox: false });
      return instance;
    }
    creating = true;
    try {
      const config = getConfigManager().getAll();
      const sandboxMode = resolveSandboxMode(config.agent.sandboxMode);
      // If a re-entrant call already initialized `instance`, reuse it and just
      // update its sandbox mode rather than discarding registered tools.
      if (instance) {
        (instance as any).sandboxEnabled = sandboxMode === 'all';
      } else {
        instance = new ToolRegistry({ sandbox: sandboxMode === 'all' });
      }
    } finally {
      creating = false;
    }
  }
  return instance;
}
export { ToolRegistry };

/**
 * Mock Tool Registry for unit testing.
 * Does not load any tools by default and allows easy inspection of calls.
 */
export class MockToolRegistry extends ToolRegistry {
  public calls: Array<{ name: string; args: Record<string, unknown> }> = [];

  constructor() {
    super({ sandbox: false });
  }

  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    this.calls.push({ name, args });
    const tool = this.get(name);
    if (tool) return tool.execute(args);
    return { success: true, output: `Mock output for ${name}` };
  }
}

