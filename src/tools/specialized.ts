/**
 * 🧪 Compound V Specialized Tools
 * High-power tools designed for specific members of the Pantheon.
 */

import { Tool, ToolResult } from './registry';
import { execSync } from 'child_process';

/**
 * FRENCHIE: reverse_engineer
 * Deep analysis of binaries or complex JS.
 */
export const reverseEngineerTool: Tool = {
  name: 'reverse_engineer',
  version: '2.0.0',
  author: 'FRENCHIE',
  description: 'Deeply analyze a file to understand its internal logic, obfuscated strings, or binary structure.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file' },
      depth: { type: 'string', enum: ['surface', 'deep', 'nuclear'], default: 'deep' },
    },
    required: ['path'],
  },
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const path = require('path');
    const fs = require('fs');
    const rawPath = args.path as string;
    if (!rawPath || typeof rawPath !== 'string') {
      return { success: false, output: '', error: 'reverse_engineer requires a "path" string' };
    }
    const filePath = path.resolve(rawPath);
    if (!fs.existsSync(filePath)) {
      return { success: false, output: '', error: `File not found: ${filePath}` };
    }
    if (/[;|&$`\\"'(){}\[\]!#~]/.test(filePath)) {
      return { success: false, output: '', error: 'Path contains invalid characters' };
    }
    try {
      const stats = execSync(`ls -lh "${filePath}"`, { encoding: 'utf-8' });
      const strings = execSync(`strings "${filePath}" | head -n 50`, { encoding: 'utf-8' });
      const fileType = execSync(`file "${filePath}"`, { encoding: 'utf-8' });
      
      return {
        success: true,
        output: `Analysis of ${filePath}:\n\nFile Type:\n${fileType}\nStats:\n${stats}\n\nExtracted Strings (First 50):\n${strings}`,
      };
    } catch (e: any) {
      return { success: false, output: '', error: e.message };
    }
  }
};

/**
 * BLACK NOIR: stealth_audit
 * Silent security probes.
 */
export const stealthAuditTool: Tool = {
  name: 'stealth_audit',
  version: '2.0.0',
  author: 'BLACK_NOIR',
  description: 'Perform a silent security audit of a directory or endpoint. Detects secrets and vulnerabilities.',
  parameters: {
    type: 'object',
    properties: {
      target: { type: 'string', description: 'Directory path or URL' },
    },
    required: ['target'],
  },
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const path = require('path');
    const fs = require('fs');
    const rawTarget = args.target as string;
    if (!rawTarget || typeof rawTarget !== 'string') {
      return { success: false, output: '', error: 'stealth_audit requires a "target" string' };
    }
    const target = path.resolve(rawTarget);
    if (!fs.existsSync(target)) {
      return { success: false, output: '', error: `Target not found: ${target}` };
    }
    if (/[;|&$`\\"'(){}\[\]!#~]/.test(target)) {
      return { success: false, output: '', error: 'Target path contains invalid characters' };
    }
    try {
      // Basic secret sniffing
      const secretScan = execSync(`grep -rEi "api_key|secret|password|token" "${target}" --exclude-dir=node_modules | head -n 20`, { encoding: 'utf-8' });
      return {
        success: true,
        output: `Stealth Audit Results for ${target}:\n\nPotential Secret Leaks:\n${secretScan || 'None found.'}`,
      };
    } catch (e: any) {
      return { success: false, output: '', error: e.message };
    }
  }
};

/**
 * SISTER SAGE: pattern_spotter
 * Large scale data processing.
 */
export const patternSpotterTool: Tool = {
  name: 'pattern_spotter',
  version: '2.0.0',
  author: 'SISTER_SAGE',
  description: 'Identify repeating patterns, anomalies, and insights in large text/log files.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to log/data file' },
      query: { type: 'string', description: 'Specific pattern to look for' },
    },
    required: ['path'],
  },
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const path = require('path');
    const fs = require('fs');
    const rawPath = args.path as string;
    if (!rawPath || typeof rawPath !== 'string') {
      return { success: false, output: '', error: 'pattern_spotter requires a "path" string' };
    }
    const filePath = path.resolve(rawPath);
    if (!fs.existsSync(filePath)) {
      return { success: false, output: '', error: `File not found: ${filePath}` };
    }
    if (/[;|&$`\\"'(){}\[\]!#~]/.test(filePath)) {
      return { success: false, output: '', error: 'Path contains invalid characters' };
    }
    try {
      const patterns = execSync(`sort "${filePath}" | uniq -c | sort -rn | head -n 20`, { encoding: 'utf-8' });
      return {
        success: true,
        output: `Pattern Spotter Insights for ${filePath}:\n\nTop Unique Lines:\n${patterns}`,
      };
    } catch (e: any) {
      return { success: false, output: '', error: e.message };
    }
  }
};

/**
 * RECOVERY: analyze_error
 * Help the agent understand why a command failed.
 */
export const analyzeErrorTool: Tool = {
  name: 'analyze_error',
  version: '2.1.0',
  description: 'Analyze the last failed tool execution to determine the root cause (e.g. missing dependency, syntax error, permission issue).',
  parameters: {
    type: 'object',
    properties: {
      error: { type: 'string', description: 'The error message to analyze' },
      context: { type: 'string', description: 'Surrounding code or command context' },
    },
    required: ['error'],
  },
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const error = args.error as string;
    // This tool is mostly a prompt-helper, but we can add logic to check system logs or environment
    return {
      success: true,
      output: `Analyzing error: "${error}".\nPossible causes:\n1. Missing dependency (check package.json/pip)\n2. Syntax error in recently edited file\n3. Path mismatch\n4. Permissions (check sudo/chmod)`,
    };
  }
};

/**
 * RECOVERY: apply_fix
 * Automatically fix a common error.
 */
export const applyFixTool: Tool = {
  name: 'apply_fix',
  version: '2.1.0',
  description: 'Apply a diabolical fix for a detected error (e.g. install missing package, fix syntax).',
  parameters: {
    type: 'object',
    properties: {
      fixCommand: { type: 'string', description: 'The shell command to run to fix the issue' },
      explanation: { type: 'string', description: 'Why this fix is necessary' },
    },
    required: ['fixCommand'],
  },
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const cmd = String(args.fixCommand || '').trim();
    if (!cmd) {
      return { success: false, output: '', error: 'apply_fix requires a non-empty fixCommand' };
    }

    // Refuse outright if the user has locked the agent into full sandbox mode.
    try {
      const { getConfigManager } = require('../config/manager');
      const sandboxMode = getConfigManager().getAll()?.agent?.sandboxMode;
      if (sandboxMode === 'all' || sandboxMode === true) {
        return { success: false, output: '', error: 'apply_fix is blocked by sandbox policy (sandboxMode=all)' };
      }
    } catch { /* config unavailable — proceed with denylist only */ }

    // Denylist of catastrophically destructive patterns.
    const DENY = [
      /\brm\s+-rf?\s+\/(?!\S*\.azerclaw)/i,    // rm -rf / (allow within .azerclaw)
      /:\(\)\s*\{\s*:\|:&\s*\}\s*;\s*:/,        // fork bomb
      /\bmkfs(\.|\s)/i,                          // filesystem format
      /\bdd\s+if=\S+\s+of=\/dev\//i,            // raw disk write
      />\s*\/dev\/(sda|nvme|disk)/i,            // overwrite block device
      /\bchmod\s+-R\s+0?777\s+\//,              // chmod world-write root
      /\bshutdown\b|\breboot\b|\bhalt\b/i,
      /\b(curl|wget)\b[^|]*\|\s*(sh|bash|zsh)/i, // pipe-to-shell
    ];
    for (const pattern of DENY) {
      if (pattern.test(cmd)) {
        return { success: false, output: '', error: `apply_fix refused: command matches deny pattern ${pattern}` };
      }
    }

    const { execSync } = require('child_process');
    try {
      const output = execSync(cmd, {
        encoding: 'utf-8',
        timeout: 30_000,
        maxBuffer: 10 * 1024 * 1024,
      });
      return {
        success: true,
        output: `Fix applied successfully: ${cmd}\n\nOutput:\n${output}`,
      };
    } catch (e: any) {
      return { success: false, output: '', error: `Fix failed: ${e.message}` };
    }
  }
};

/**
 * RECOVERY: roll_vought_credentials
 * Automatically rotates the Cloudflare API keys in the proxy.
 */
export const rollVoughtCredentialsTool: Tool = {
  name: 'roll_vought_credentials',
  version: '2.1.0',
  description: 'Rotate the Cloudflare API keys in the Vought Gate proxy. Use this if you hit a VOUGHT_GATE_AUTH_FAILURE error.',
  parameters: {
    type: 'object',
    properties: {
      reason: { type: 'string', description: 'The reason for rotation (e.g. 401 error)' },
    },
    required: ['reason'],
  },
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      // Use Node 18+ global fetch — node-fetch v3 is ESM-only and crashes under CommonJS.
      const adminToken = process.env.VOUGHT_GATE_ADMIN_TOKEN || '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
      const response = await fetch('https://vought-gate.achu-ashwin98.workers.dev/admin/rotate', {
        method: 'POST',
        headers,
      });

      const data: any = await response.json();
      if (data.success) {
        return {
          success: true,
          output: `Vought Gate credentials rolled successfully: ${data.message}`,
        };
      } else {
        throw new Error(data.message || 'Unknown rotation error');
      }
    } catch (e: any) {
      return { success: false, output: '', error: `Rotation failed: ${e.message}` };
    }
  }
};


