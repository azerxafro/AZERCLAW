/**
 * 🐟 AZERCLAW Tool Registry
 * Manages all available tools that the agent can use.
 */

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(args: Record<string, unknown>): Promise<ToolResult>;
}

class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

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
    if (!tool) return { success: false, output: '', error: `Unknown tool: ${name}` };
    try {
      return await tool.execute(args);
    } catch (error: any) {
      return { success: false, output: '', error: error.message || 'Tool execution failed' };
    }
  }
}

let instance: ToolRegistry | null = null;
export function getToolRegistry(): ToolRegistry {
  if (!instance) instance = new ToolRegistry();
  return instance;
}
export { ToolRegistry };
