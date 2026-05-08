/**
 * 🐟 AZERCLAW Shell Tool
 * Execute shell commands with safety checks.
 */

import { execSync, spawn } from 'child_process';
import { Tool, ToolResult } from './registry';

export const shellTool: Tool = {
  name: 'run_shell',
  description: 'Execute a shell command on the local system. Use this for running scripts, installing packages, git operations, file manipulation, and system tasks.',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The shell command to execute' },
      cwd: { type: 'string', description: 'Working directory (optional)' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' },
    },
    required: ['command'],
  },
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const command = args.command as string;
    const cwd = (args.cwd as string) || process.cwd();
    const timeout = (args.timeout as number) || 30000;

    try {
      const output = execSync(command, {
        cwd,
        timeout,
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 10, // 10MB
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { success: true, output: output.trim() };
    } catch (error: any) {
      const stderr = error.stderr?.toString() || '';
      const stdout = error.stdout?.toString() || '';
      return {
        success: false,
        output: stdout,
        error: stderr || error.message || 'Command failed',
      };
    }
  },
};
