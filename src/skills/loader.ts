/**
 * 🐟 AZERCLAW Skills System
 * Load and execute SKILL.md files compatible with the OpenClaw ecosystem.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SkillMetadata {
  name: string;
  description: string;
  version?: string;
  author?: string;
  tags?: string[];
  os?: string[];
  requires?: string[];
}

export interface Skill {
  metadata: SkillMetadata;
  instructions: string;
  filePath: string;
  source: 'workspace' | 'project' | 'personal' | 'managed' | 'bundled';
}

// ─── Skill Discovery Paths (priority order) ────────────────────

function getSkillPaths(workspaceDir?: string): { path: string; source: Skill['source'] }[] {
  const paths: { path: string; source: Skill['source'] }[] = [];
  
  if (workspaceDir) {
    paths.push({ path: path.join(workspaceDir, 'skills'), source: 'workspace' });
    paths.push({ path: path.join(workspaceDir, '.agents', 'skills'), source: 'project' });
  }
  
  paths.push({ path: path.join(os.homedir(), '.agents', 'skills'), source: 'personal' });
  paths.push({ path: path.join(os.homedir(), '.azerclaw', 'skills'), source: 'managed' });
  paths.push({ path: path.join(__dirname, '..', '..', 'skills'), source: 'bundled' });
  
  return paths;
}

// ─── SKILL.md Parser ────────────────────────────────────────────

function parseSkillFile(filePath: string, source: Skill['source']): Skill | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Parse YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    
    let metadata: SkillMetadata;
    let instructions: string;
    
    if (frontmatterMatch) {
      metadata = parseYamlFrontmatter(frontmatterMatch[1]);
      instructions = frontmatterMatch[2].trim();
    } else {
      // No frontmatter — use filename as name
      const name = path.basename(path.dirname(filePath));
      metadata = { name, description: `Skill: ${name}` };
      instructions = content.trim();
    }
    
    return { metadata, instructions, filePath, source };
  } catch {
    return null;
  }
}

function parseYamlFrontmatter(yaml: string): SkillMetadata {
  const metadata: SkillMetadata = { name: '', description: '' };
  
  for (const line of yaml.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();
    
    switch (key) {
      case 'name': metadata.name = value; break;
      case 'description': metadata.description = value; break;
      case 'version': metadata.version = value; break;
      case 'author': metadata.author = value; break;
      case 'tags': metadata.tags = value.split(',').map(t => t.trim()); break;
      case 'os': metadata.os = value.split(',').map(t => t.trim()); break;
      case 'requires': metadata.requires = value.split(',').map(t => t.trim()); break;
    }
  }
  
  return metadata;
}

// ─── Skill Loader ───────────────────────────────────────────────

export function loadAllSkills(workspaceDir?: string): Skill[] {
  const skills: Skill[] = [];
  const seen = new Set<string>();
  
  for (const { path: skillDir, source } of getSkillPaths(workspaceDir)) {
    if (!fs.existsSync(skillDir)) continue;
    
    try {
      const entries = fs.readdirSync(skillDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        
        const skillFile = path.join(skillDir, entry.name, 'SKILL.md');
        if (!fs.existsSync(skillFile)) continue;
        
        // Higher-priority sources override lower-priority
        if (seen.has(entry.name)) continue;
        
        const skill = parseSkillFile(skillFile, source);
        if (skill) {
          // Check OS compatibility
          if (skill.metadata.os && !skill.metadata.os.includes(process.platform)) {
            continue;
          }
          
          skills.push(skill);
          seen.add(entry.name);
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }
  
  return skills;
}

/**
 * Format skills as context for the agent system prompt.
 */
export function formatSkillsForPrompt(skills: Skill[]): string {
  if (skills.length === 0) return '';
  
  let context = '\n\n## Available Skills\n\n';
  for (const skill of skills) {
    context += `### ${skill.metadata.name}\n`;
    context += `${skill.metadata.description}\n`;
    context += `Source: ${skill.source}\n\n`;
    context += `Instructions:\n${skill.instructions}\n\n---\n\n`;
  }
  return context;
}
