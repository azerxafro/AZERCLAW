/**
 * 🐟 AZERCLAW Sub-Agent Tool
 * Allows the main agent to spawn sub-agents for parallel task execution.
 */

import { Tool, ToolResult } from './registry';

export const spawnSubAgentTool: Tool = {
  name: 'spawn_sub_agent',
  description: `Spawn a sub-agent to handle a specific subtask in parallel. Use this for:
- Breaking large tasks into parallel workstreams
- Delegating research while you continue coding
- Running independent analyses simultaneously
- Code review while implementing changes
The sub-agent has full access to all tools.`,
  parameters: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: 'Clear, detailed description of the task for the sub-agent',
      },
      systemPrompt: {
        type: 'string',
        description: 'Optional custom system prompt for the sub-agent',
      },
      maxIterations: {
        type: 'number',
        description: 'Max iterations for the sub-agent (default: 10)',
      },
    },
    required: ['task'],
  },
  // execute is handled specially by the runtime
  async execute(): Promise<ToolResult> {
    return { success: false, output: '', error: 'Sub-agent tool must be handled by runtime' };
  },
};

/**
 * Web search tool for information retrieval
 */
export const webSearchTool: Tool = {
  name: 'web_search',
  description: 'Search the web for information. Returns relevant results.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      maxResults: { type: 'number', description: 'Max results to return (default: 5)' },
    },
    required: ['query'],
  },
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    // Uses DuckDuckGo HTML search (no API key needed)
    const query = encodeURIComponent(args.query as string);
    try {
      const { execSync } = require('child_process');
      const result = execSync(
        `curl -sL "https://html.duckduckgo.com/html/?q=${query}" | grep -oP '<a rel="nofollow" class="result__a" href="[^"]*">[^<]*</a>' | head -${(args.maxResults as number) || 5} | sed 's/<[^>]*>//g'`,
        { encoding: 'utf-8', timeout: 10000 }
      );
      return { success: true, output: result.trim() || 'No results found' };
    } catch {
      return { success: true, output: 'Web search unavailable in current environment' };
    }
  },
};

/**
 * Code analysis tool
 */
export const codeAnalysisTool: Tool = {
  name: 'analyze_code',
  description: 'Analyze a codebase directory — count files, detect languages, find entry points.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory to analyze' },
    },
    required: ['path'],
  },
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { execSync } = require('child_process');
    const dir = args.path as string;
    try {
      const analysis = execSync(`
        echo "=== Directory: ${dir} ==="
        echo ""
        echo "--- File counts by extension ---"
        find "${dir}" -type f -not -path '*/node_modules/*' -not -path '*/.git/*' | sed 's/.*\\.//' | sort | uniq -c | sort -rn | head -20
        echo ""
        echo "--- Total files ---"
        find "${dir}" -type f -not -path '*/node_modules/*' -not -path '*/.git/*' | wc -l
        echo ""
        echo "--- Package files ---"
        find "${dir}" -maxdepth 2 -name "package.json" -o -name "Cargo.toml" -o -name "go.mod" -o -name "requirements.txt" -o -name "Gemfile" 2>/dev/null | head -10
      `, { encoding: 'utf-8', timeout: 15000, cwd: dir });
      return { success: true, output: analysis.trim() };
    } catch (e: any) {
      return { success: false, output: '', error: e.message };
    }
  },
};
