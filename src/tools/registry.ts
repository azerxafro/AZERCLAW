/**
 * 🐟 AZERCLAW Tool Registry
 * Manages all available tools that the agent can use.
 */

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: Record<string, unknown>; // For telemetry and self-correction hints
}

export interface ToolExecutionContext {
  agentId?: string;
  timeoutMs?: number; // Default execution timeout
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
  private sandboxEnabled: boolean = false;

  constructor(options: { sandbox?: boolean } = {}) {
    this.sandboxEnabled = options.sandbox || false;
  }

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  getDefinitions(): any[] {
    return this.getAll().map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      console.warn(`[ToolRegistry] Attempted to execute unknown tool: ${name}`);
      return { success: false, output: '', error: `Unknown tool: ${name}` };
    }
    
    const startTime = Date.now();
    console.log(`[ToolRegistry] Executing '${name}' (v${tool.version})...`);
    
    try {
      let result: ToolResult;
      
      if (this.sandboxEnabled) {
        result = await this.executeInSandbox(tool, args);
      } else {
        result = await tool.execute(args);
      }
      
      const duration = Date.now() - startTime;
      console.log(`[ToolRegistry] '${name}' completed in ${duration}ms. Success: ${result.success}`);
      
      // Telemetry hook (local only as per AZERCLAW policy)
      this.logTelemetry(name, duration, result.success);
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[ToolRegistry] '${name}' failed in ${duration}ms:`, error.message);
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
      result: null as any
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
export function getToolRegistry(): ToolRegistry {
  if (!instance) {
    const { getConfigManager } = require('../config/manager');
    const config = getConfigManager().getAll();
    instance = new ToolRegistry({ sandbox: config.agent.sandboxMode });
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



