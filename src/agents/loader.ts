/**
 * 🐟 AZERCLAW Agent Loader
 * Loads agent definitions from .md files in the agents/ directory,
 * merging file-based definitions with the built-in TypeScript definitions.
 * Supports /AGENT command routing.
 */

import * as fs from 'fs';
import * as path from 'path';
import { AgentDefinition, BUILT_IN_AGENTS, getAgent } from './builtin';

// ─── Load agents from .md files ─────────────────────────────────

export function loadAgentsFromDirectory(dir: string): AgentDefinition[] {
  const agents: AgentDefinition[] = [];
  if (!fs.existsSync(dir)) return agents;

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'README.md');

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8');
      const parsed = parseAgentMd(content, file);
      if (parsed) agents.push(parsed);
    } catch { /* skip malformed */ }
  }

  return agents;
}

function parseAgentMd(content: string, filename: string): AgentDefinition | null {
  // Parse YAML frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) return null;

  const metadata: Record<string, string> = {};
  for (const line of fmMatch[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      metadata[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim();
    }
  }

  const name = metadata['name'] || path.basename(filename, '.md');
  const codename = name.toUpperCase();

  // Try to find matching built-in agent for the full system prompt
  const builtin = getAgent(name);

  return {
    id: name.toLowerCase(),
    codename,
    emoji: extractEmoji(fmMatch[2]) || builtin?.emoji || '🐟',
    role: extractRole(fmMatch[2]) || builtin?.role || 'Agent',
    description: metadata['description'] || '',
    systemPrompt: builtin?.systemPrompt || fmMatch[2],
    maxIterations: builtin?.maxIterations || 20,
    tags: builtin?.tags || extractTags(metadata['description'] || ''),
  };
}

function extractEmoji(body: string): string | null {
  const match = body.match(/^#\s+([\p{Emoji}\u200d]+)/mu);
  return match ? match[1].trim() : null;
}

function extractRole(body: string): string | null {
  const match = body.match(/\*\*Specialty\*\*:\s*(.+)/);
  return match ? match[1].trim() : null;
}

function extractTags(description: string): string[] {
  return description.toLowerCase()
    .split(/[\s,]+/)
    .filter(w => w.length > 4)
    .slice(0, 8);
}

// ─── Command Router ─────────────────────────────────────────────

export interface ParsedCommand {
  agent: string;
  flags: string[];
  task: string;
}

/**
 * Parse /AGENT //flag task format.
 * Returns null if not a command.
 */
export function parseAgentCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;

  const parts = trimmed.split(/\s+/);
  const agentName = parts[0].slice(1).toUpperCase(); // Remove /

  // Check for special group commands
  if (['PANTHEON', 'TRINITY', 'ALL', 'WARRIORS'].includes(agentName)) {
    return {
      agent: agentName,
      flags: parts.filter(p => p.startsWith('//')).map(p => p.slice(2)),
      task: parts.filter(p => !p.startsWith('/') || p === parts[0]).slice(1).join(' '),
    };
  }

  // Check if agent exists
  const agent = getAgent(agentName);
  if (!agent) return null;

  const flags = parts.filter(p => p.startsWith('//') && p.length > 2).map(p => p.slice(2));
  const taskParts = parts.filter(p => !p.startsWith('/'));
  
  return {
    agent: agentName,
    flags,
    task: taskParts.join(' '),
  };
}

/**
 * Get agents for group commands.
 */
export function resolveGroupCommand(group: string): AgentDefinition[] {
  switch (group.toUpperCase()) {
    case 'TRINITY':
      return ['orion', 'atlas', 'titan']
        .map(id => getAgent(id))
        .filter(Boolean) as AgentDefinition[];
    case 'PANTHEON':
    case 'WARRIORS':
      return BUILT_IN_AGENTS.filter(a => a.id !== 'zeus');
    case 'ALL':
      return [...BUILT_IN_AGENTS];
    default:
      return [];
  }
}
