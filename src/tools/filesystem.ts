/**
 * 🐟 AZERCLAW Filesystem Tools
 * Read, write, search, and manage files.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Tool, ToolResult } from './registry';

export const readFileTool: Tool = {
  name: 'read_file',
  version: '1.0.0',
  description: 'Read the contents of a file from disk.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute or relative path to the file' },
      startLine: { type: 'number', description: 'Start line (1-indexed, optional)' },
      endLine: { type: 'number', description: 'End line (1-indexed, optional)' },
    },
    required: ['path'],
  },
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const filePath = args.path as string;
    try {
      const resolved = path.resolve(filePath);
      if (!fs.existsSync(resolved)) return { success: false, output: '', error: `File not found: ${resolved}` };
      let content = fs.readFileSync(resolved, 'utf-8');
      if (args.startLine || args.endLine) {
        const lines = content.split('\n');
        const start = Math.max(0, ((args.startLine as number) || 1) - 1);
        const end = Math.min(lines.length, (args.endLine as number) || lines.length);
        content = lines.slice(start, end).join('\n');
      }
      return { success: true, output: content };
    } catch (e: any) { return { success: false, output: '', error: e.message }; }
  },
};

export const writeFileTool: Tool = {
  name: 'write_file',
  version: '1.0.0',
  description: 'Write content to a file. Creates parent directories if needed.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file' },
      content: { type: 'string', description: 'Content to write' },
      append: { type: 'boolean', description: 'Append instead of overwrite (default: false)' },
    },
    required: ['path', 'content'],
  },
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const filePath = path.resolve(args.path as string);
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      if (args.append) {
        fs.appendFileSync(filePath, args.content as string);
      } else {
        fs.writeFileSync(filePath, args.content as string);
      }
      return { success: true, output: `Written to ${filePath}` };
    } catch (e: any) { return { success: false, output: '', error: e.message }; }
  },
};

export const listDirTool: Tool = {
  name: 'list_directory',
  version: '1.0.0',
  description: 'List files and directories in a given path.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory path' },
      recursive: { type: 'boolean', description: 'List recursively (default: false)' },
    },
    required: ['path'],
  },
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const dirPath = path.resolve(args.path as string);
    try {
      if (!fs.existsSync(dirPath)) return { success: false, output: '', error: `Not found: ${dirPath}` };
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      const listing = entries.map(e => {
        const type = e.isDirectory() ? '[DIR]' : '[FILE]';
        const size = e.isFile() ? ` (${fs.statSync(path.join(dirPath, e.name)).size}b)` : '';
        return `${type} ${e.name}${size}`;
      }).join('\n');
      return { success: true, output: listing };
    } catch (e: any) { return { success: false, output: '', error: e.message }; }
  },
};

export const searchFilesTool: Tool = {
  name: 'search_files',
  version: '1.0.0',
  description: 'Search for a text pattern in files using grep-like functionality.',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Text or regex pattern to search for' },
      path: { type: 'string', description: 'Directory or file to search in' },
      filePattern: { type: 'string', description: 'Glob pattern for file filtering (e.g. "*.ts")' },
    },
    required: ['pattern', 'path'],
  },
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const searchPath = path.resolve(args.path as string);
    const pattern = args.pattern as string;
    try {
      const { execSync } = require('child_process');
      const fileFilter = args.filePattern ? `--include="${args.filePattern}"` : '';
      const cmd = `grep -rnI ${fileFilter} "${pattern}" "${searchPath}" 2>/dev/null | head -50`;
      const output = execSync(cmd, { encoding: 'utf-8', timeout: 10000 });
      return { success: true, output: output.trim() || 'No matches found' };
    } catch { return { success: true, output: 'No matches found' }; }
  },
};

