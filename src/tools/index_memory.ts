/**
 * 🧠 Deep Project Memory Tool
 * Uses flexsearch for high-performance local indexing of the workspace.
 */

import { Tool, ToolResult } from './registry';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Index } from 'flexsearch';

const INDEX_FILE = path.join(os.homedir(), '.azerclaw', 'memory', 'project_index.json');
let searchIndex: any = null;

async function getIndex() {
  if (searchIndex) return searchIndex;
  
  searchIndex = new Index({
    tokenize: "forward",
  });

  try {
    const data = await fs.readFile(INDEX_FILE, 'utf-8');
    const json = JSON.parse(data);
    // Note: flexsearch import/export is a bit complex in commonjs, 
    // for now we re-index if not loaded or just store keys.
  } catch { /* fresh index */ }
  
  return searchIndex;
}

/**
 * SISTER SAGE: index_project
 */
export const indexProjectTool: Tool = {
  name: 'index_project',
  version: '2.1.0',
  description: 'Recursively index all text/code files in the current workspace for instant retrieval.',
  parameters: {
    type: 'object',
    properties: {
      directory: { type: 'string', description: 'Root directory to index (default: current)' },
    },
  },
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const rootDir = (args.directory as string) || process.cwd();
    const index = await getIndex();
    let fileCount = 0;

    async function scan(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
          await scan(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (['.ts', '.js', '.md', '.json', '.txt', '.py', '.go', '.rs'].includes(ext)) {
            const content = await fs.readFile(fullPath, 'utf-8');
            index.add(fullPath, content.slice(0, 10000)); // Index first 10k chars
            fileCount++;
          }
        }
      }
    }

    try {
      await scan(rootDir);
      return { success: true, output: `Successfully indexed ${fileCount} files in ${rootDir}.` };
    } catch (e: any) {
      return { success: false, output: '', error: e.message };
    }
  }
};

/**
 * SISTER SAGE: semantic_search
 */
export const semanticSearchTool: Tool = {
  name: 'semantic_search',
  version: '2.1.0',
  description: 'Search the project index for relevant code snippets or documentation.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query or code snippet to find' },
      limit: { type: 'number', default: 5 },
    },
    required: ['query'],
  },
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const index = await getIndex();
    const results = index.search(args.query as string, { limit: args.limit as number });
    
    if (results.length === 0) {
      return { success: true, output: 'No matching files found in index. Try running index_project first.' };
    }

    return {
      success: true,
      output: `Found ${results.length} matches:\n\n${results.join('\n')}`,
    };
  }
};
