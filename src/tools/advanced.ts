/**
 * 🐟 AZERCLAW Sub-Agent Tool
 * Allows the main agent to spawn sub-agents for parallel task execution.
 */

import { Tool, ToolResult } from './registry';

export const spawnSubAgentTool: Tool = {
  name: 'spawn_sub_agent',
  version: '1.0.0',
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
  version: '1.0.0',
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
    const rawQuery = args.query as string;
    if (!rawQuery || typeof rawQuery !== 'string' || rawQuery.trim().length === 0) {
      return { success: false, output: '', error: 'web_search requires a non-empty "query" string' };
    }
    const maxResults = Math.max(1, Math.min(20, Math.floor(Number(args.maxResults) || 5)));
    try {
      // Use global fetch (Node 18+) — no shell, no injection surface.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      let html = '';
      try {
        const res = await fetch(
          `https://html.duckduckgo.com/html/?q=${encodeURIComponent(rawQuery)}`,
          { signal: controller.signal, headers: { 'User-Agent': 'azerclaw/2.0' } }
        );
        html = await res.text();
      } finally {
        clearTimeout(timeout);
      }
      // Extract titles in JS rather than piping through perl.
      const matches: string[] = [];
      const re = /<a rel="nofollow" class="result__a" href="[^"]*">([^<]*)<\/a>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) !== null && matches.length < maxResults) {
        matches.push(m[1].trim());
      }
      return { success: true, output: matches.join('\n') || 'No results found' };
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
  version: '1.0.0',
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
    const path = require('path');
    const fs = require('fs');
    const rawDir = args.path as string;
    if (!rawDir || typeof rawDir !== 'string') {
      return { success: false, output: '', error: 'analyze_code requires a "path" string' };
    }
    // Resolve to absolute path and validate it exists — prevents shell metacharacter injection
    const dir = path.resolve(rawDir);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      return { success: false, output: '', error: `Directory not found: ${dir}` };
    }
    // Reject paths with shell metacharacters
    if (/[;|&$`\\"'(){}\[\]!#~]/.test(dir)) {
      return { success: false, output: '', error: 'Path contains invalid characters' };
    }
    try {
      const extCounts: Record<string, number> = {};
      let totalFiles = 0;
      const packageFiles: string[] = [];

      const walk = (currentPath: string, depth = 0) => {
        const base = path.basename(currentPath);
        if (base === 'node_modules' || base === '.git' || base === 'dist' || base === 'build') return;

        try {
          const stat = fs.statSync(currentPath);
          if (stat.isDirectory()) {
            const files = fs.readdirSync(currentPath);
            for (const file of files) {
              walk(path.join(currentPath, file), depth + 1);
            }
          } else if (stat.isFile()) {
            totalFiles++;
            
            // Extension count
            let ext = path.extname(currentPath).toLowerCase().slice(1);
            if (!ext) ext = 'no-extension';
            extCounts[ext] = (extCounts[ext] || 0) + 1;

            // Package files (maxdepth 2 check: depth 0 is root dir, depth 1 is direct children)
            if (depth <= 2) {
              const lowerBase = base.toLowerCase();
              if (['package.json', 'cargo.toml', 'go.mod', 'requirements.txt', 'gemfile'].includes(lowerBase)) {
                packageFiles.push(currentPath);
              }
            }
          }
        } catch { /* ignore read / access errors */ }
      };

      walk(dir, 0);

      // Format file counts by extension
      const extensionLines = Object.entries(extCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([ext, count]) => `   ${count} ${ext}`)
        .join('\n');

      const packageLines = packageFiles.slice(0, 10).join('\n');

      const lines = [
        `=== Directory: ${dir} ===`,
        '',
        '--- File counts by extension ---',
        extensionLines || 'No files found',
        '',
        '--- Total files ---',
        `${totalFiles}`,
        '',
        '--- Package files ---',
        packageLines || 'No package files found'
      ].join('\n');

      return { success: true, output: lines };
    } catch (e: any) {
      return { success: false, output: '', error: e.message };
    }
  },
};

