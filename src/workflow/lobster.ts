/**
 * 🐟 AZERCLAW Lobster YAML Compatibility
 * OpenClaw Lobster workflow format compatibility layer for Fishbone engine
 */

import * as fs from 'fs';
import * as path from 'path';
// Note: js-yaml is an optional dependency
// import * as yaml from 'js-yaml';
import { FishboneWorkflow, FishboneStep } from './engine';

// Extend FishboneStep to include description for Lobster compatibility
interface ExtendedFishboneStep extends FishboneStep {
  description?: string;
}

// ─── Lobster YAML Types ───────────────────────────────────────────────

export interface LobsterWorkflow {
  name: string;
  description?: string;
  version?: string;
  metadata?: {
    author?: string;
    tags?: string[];
    category?: string;
  };
  triggers?: LobsterTrigger[];
  variables?: Record<string, any>;
  steps: LobsterStep[];
  onError?: {
    retry?: number;
    notify?: string[];
  };
}

export interface LobsterTrigger {
  type: 'webhook' | 'schedule' | 'event' | 'manual';
  config: Record<string, any>;
}

export interface LobsterStep {
  id: string;
  name: string;
  description?: string;
  type: 'llm' | 'tool' | 'function' | 'condition' | 'loop' | 'parallel' | 'http' | 'shell';
  config: Record<string, any>;
  inputs?: Record<string, any>;
  outputs?: string[];
  condition?: string; // For conditional execution
  retry?: {
    maxAttempts?: number;
    backoff?: 'fixed' | 'exponential';
    delay?: number;
  };
  timeout?: number;
  dependsOn?: string[]; // Step dependencies
  approval?: {
    required: boolean;
    message?: string;
    approvers?: string[];
  };
}

// ─── Lobster to Fishbone Converter ─────────────────────────────────────

export class LobsterConverter {
  /**
   * Convert Lobster YAML workflow to Fishbone workflow
   */
  static convertLobsterToFishbone(lobster: LobsterWorkflow): FishboneWorkflow {
    const fishbone: FishboneWorkflow = {
      name: lobster.name,
      description: lobster.description || '',
      version: lobster.version || '1.0.0',
      trigger: this.convertTriggers(lobster.triggers),
      variables: this.convertVariables(lobster.variables || {}),
      steps: lobster.steps.map(step => this.convertStep(step))
    };

    return fishbone;
  }

  /**
   * Parse Lobster YAML file and convert to Fishbone
   */
  static parseLobsterFile(filePath: string): FishboneWorkflow {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    try {
      // Simple YAML parser fallback for demo purposes
      // In production, use proper yaml library
      const lobster = this.parseSimpleYAML(content) as LobsterWorkflow;
      return this.convertLobsterToFishbone(lobster);
    } catch (error) {
      throw new Error(`Failed to parse Lobster YAML file: ${(error as Error).message}`);
    }
  }

  static parseSimpleYAML(content: string): any {
    const result: any = {};
    const lines = content.split('\n');
    const stack: Array<{ obj: any; indent: number; key?: string }> = [{ obj: result, indent: -1 }];
    let lastIndent = 0;
    
    for (const line of lines) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      
      const indent = line.length - line.trimStart().length;
      const trimmed = line.trim();
      
      // Pop stack to find the correct parent for current indent
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }
      const current = stack[stack.length - 1].obj;
      
      if (trimmed.startsWith('- ')) {
        // Array item
        const value = trimmed.slice(2).trim();
        if (!Array.isArray(current)) {
          // Replace object with array if needed (shouldn't happen in valid YAML)
          continue;
        }
        if (value.includes(':')) {
          // Array of objects: "- key: value" or "- key:"
          const [k, ...vParts] = value.split(':');
          const v = vParts.join(':').trim();
          if (v === '') {
            const newObj: any = {};
            current.push(newObj);
            stack.push({ obj: newObj, indent });
          } else {
            current.push({ [k.trim()]: v.replace(/^["']|["']$/g, '') });
          }
        } else {
          current.push(value.replace(/^["']|["']$/g, ''));
        }
      } else if (trimmed.includes(':')) {
        // Key-value pair
        const [key, ...valueParts] = trimmed.split(':');
        const value = valueParts.join(':').trim();
        const cleanKey = key.trim();
        
        if (value === '') {
          // Could be object or array - look ahead
          const nextLineIdx = lines.indexOf(line) + 1;
          const nextLine = lines[nextLineIdx];
          if (nextLine && nextLine.trim().startsWith('- ')) {
            current[cleanKey] = [];
            stack.push({ obj: current[cleanKey], indent, key: cleanKey });
          } else {
            current[cleanKey] = {};
            stack.push({ obj: current[cleanKey], indent, key: cleanKey });
          }
        } else {
          // Try to parse as number, boolean, or string
          const cleanValue = value.replace(/^["']|["']$/g, '');
          if (cleanValue === 'true') current[cleanKey] = true;
          else if (cleanValue === 'false') current[cleanKey] = false;
          else if (/^-?\d+$/.test(cleanValue)) current[cleanKey] = parseInt(cleanValue, 10);
          else if (/^-?\d+\.\d+$/.test(cleanValue)) current[cleanKey] = parseFloat(cleanValue);
          else current[cleanKey] = cleanValue;
        }
      }
      
      lastIndent = indent;
    }
    
    return result;
  }

  /**
   * Convert Lobster triggers to Fishbone trigger string
   */
  private static convertTriggers(triggers?: LobsterTrigger[]): string | undefined {
    if (!triggers || triggers.length === 0) {
      return undefined;
    }

    const triggerStrings = triggers.map(trigger => {
      switch (trigger.type) {
        case 'schedule':
          return `schedule:${trigger.config.cron || trigger.config.interval}`;
        case 'webhook':
          return `webhook:${trigger.config.path || trigger.config.event}`;
        case 'event':
          return `event:${trigger.config.name}`;
        case 'manual':
          return 'manual';
        default:
          return trigger.type;
      }
    });

    return triggerStrings.join(',');
  }

  /**
   * Convert Lobster variables to Fishbone variables
   */
  private static convertVariables(lobsterVars: Record<string, any>): Record<string, string> {
    const fishboneVars: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(lobsterVars)) {
      if (typeof value === 'string') {
        fishboneVars[key] = value;
      } else {
        fishboneVars[key] = JSON.stringify(value);
      }
    }

    return fishboneVars;
  }

  /**
   * Convert Lobster step to Fishbone step
   */
  private static convertStep(lobsterStep: LobsterStep): ExtendedFishboneStep {
    const fishboneStep: ExtendedFishboneStep = {
      id: lobsterStep.id,
      name: lobsterStep.name,
      type: this.convertStepType(lobsterStep.type),
      action: this.convertStepAction(lobsterStep),
      inputs: this.convertStepInputs(lobsterStep.inputs),
      outputs: lobsterStep.outputs,
      requiresApproval: lobsterStep.approval?.required,
      onError: this.convertStepError(lobsterStep),
      timeout: lobsterStep.timeout,
      description: lobsterStep.description
    };

    // Handle parallel steps
    if (lobsterStep.type === 'parallel' && lobsterStep.config.steps) {
      fishboneStep.children = (lobsterStep.config.steps as LobsterStep[]).map(child => 
        this.convertStep(child)
      );
    }

    return fishboneStep;
  }

  /**
   * Convert Lobster step type to Fishbone step type
   */
  private static convertStepType(lobsterType: string): FishboneStep['type'] {
    switch (lobsterType) {
      case 'llm':
        return 'agent';
      case 'tool':
      case 'function':
        return 'agent';
      case 'condition':
        return 'condition';
      case 'loop':
        return 'agent'; // Convert loops to agent steps
      case 'parallel':
        return 'parallel';
      case 'http':
        return 'shell';
      case 'shell':
        return 'shell';
      default:
        return 'agent';
    }
  }

  /**
   * Convert Lobster step action to Fishbone step action
   */
  private static convertStepAction(lobsterStep: LobsterStep): string {
    switch (lobsterStep.type) {
      case 'llm':
        return lobsterStep.config.prompt || lobsterStep.config.message || lobsterStep.name;
      
      case 'tool':
      case 'function':
        if (lobsterStep.config.tool) {
          const args = lobsterStep.config.arguments || {};
          const argString = Object.entries(args)
            .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
            .join(' ');
          return `${lobsterStep.config.tool} ${argString}`;
        }
        return lobsterStep.config.function || lobsterStep.name;
      
      case 'condition':
        return lobsterStep.config.expression || lobsterStep.condition || 'true';
      
      case 'loop':
        const loopConfig = lobsterStep.config;
        return `Loop ${loopConfig.times || 'unknown'} times: ${loopConfig.action || lobsterStep.name}`;
      
      case 'http':
        const method = lobsterStep.config.method || 'GET';
        const url = lobsterStep.config.url || '';
        return `curl -X ${method} ${url}`;
      
      case 'shell':
        return lobsterStep.config.command || lobsterStep.config.script || lobsterStep.name;
      
      default:
        return lobsterStep.description || lobsterStep.name;
    }
  }

  /**
   * Convert Lobster step inputs to Fishbone step inputs
   */
  private static convertStepInputs(lobsterInputs?: Record<string, any>): Record<string, string> | undefined {
    if (!lobsterInputs) {
      return undefined;
    }

    const fishboneInputs: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(lobsterInputs)) {
      if (typeof value === 'string') {
        fishboneInputs[key] = value;
      } else {
        fishboneInputs[key] = JSON.stringify(value);
      }
    }

    return fishboneInputs;
  }

  /**
   * Convert Lobster step error handling to Fishbone step error handling
   */
  private static convertStepError(lobsterStep: LobsterStep): FishboneStep['onError'] {
    if (lobsterStep.retry) {
      if (lobsterStep.retry.maxAttempts && lobsterStep.retry.maxAttempts > 1) {
        return 'retry';
      }
    }
    
    // Default to stop for critical steps, continue for others
    return 'stop';
  }
}

// ─── Lobster Workflow Validator ───────────────────────────────────────

export class LobsterValidator {
  /**
   * Validate Lobster workflow structure
   */
  static validate(lobster: LobsterWorkflow): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!lobster.name) {
      errors.push('Workflow name is required');
    }

    if (!lobster.steps || lobster.steps.length === 0) {
      errors.push('Workflow must have at least one step');
    }

    // Validate steps
    if (lobster.steps) {
      const stepIds = new Set<string>();
      
      for (const step of lobster.steps) {
        // Validate step ID
        if (!step.id) {
          errors.push(`Step "${step.name}" is missing an ID`);
        } else if (stepIds.has(step.id)) {
          errors.push(`Duplicate step ID: ${step.id}`);
        } else {
          stepIds.add(step.id);
        }

        // Validate step name
        if (!step.name) {
          errors.push(`Step "${step.id}" is missing a name`);
        }

        // Validate step type
        const validTypes = ['llm', 'tool', 'function', 'condition', 'loop', 'parallel', 'http', 'shell'];
        if (!validTypes.includes(step.type)) {
          errors.push(`Invalid step type "${step.type}" in step "${step.id}"`);
        }

        // Validate dependencies
        if (step.dependsOn) {
          for (const dep of step.dependsOn) {
            if (!stepIds.has(dep)) {
              warnings.push(`Step "${step.id}" depends on non-existent step "${dep}"`);
            }
          }
        }

        // Validate parallel steps
        if (step.type === 'parallel' && step.config.steps) {
          for (const childStep of step.config.steps as LobsterStep[]) {
            if (!childStep.id) {
              errors.push(`Parallel child step is missing an ID`);
            }
          }
        }
      }
    }

    // Validate triggers
    if (lobster.triggers) {
      for (const trigger of lobster.triggers) {
        if (!trigger.type) {
          errors.push('Trigger is missing a type');
        }

        const validTriggerTypes = ['webhook', 'schedule', 'event', 'manual'];
        if (!validTriggerTypes.includes(trigger.type)) {
          errors.push(`Invalid trigger type "${trigger.type}"`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// ─── Enhanced Fishbone Engine with Lobster Support ───────────────────────

export class EnhancedFishboneEngine {
  /**
   * Execute workflow from either Fishbone or Lobster format
   */
  static async executeWorkflow(
    workflowPath: string,
    variables: Record<string, string> = {},
    eventHandler?: any
  ): Promise<any> {
    const extension = path.extname(workflowPath).toLowerCase();
    
    if (extension === '.yaml' || extension === '.yml') {
      // Parse as Lobster YAML
      const fishboneWorkflow = LobsterConverter.parseLobsterFile(workflowPath);
      const engine = new (require('./engine').FishboneEngine)();
      return engine.execute(fishboneWorkflow, variables, eventHandler);
    } else {
      // Parse as original Fishbone format
      const { parseFishboneFile, FishboneEngine } = require('./engine');
      const fishboneWorkflow = parseFishboneFile(workflowPath);
      const engine = new FishboneEngine();
      return engine.execute(fishboneWorkflow, variables, eventHandler);
    }
  }

  /**
   * Validate workflow file (Fishbone or Lobster)
   */
  static validateWorkflow(workflowPath: string): { valid: boolean; errors: string[]; warnings: string[] } {
    const extension = path.extname(workflowPath).toLowerCase();
    
    if (extension === '.yaml' || extension === '.yml') {
      // Validate Lobster YAML
      try {
        const content = fs.readFileSync(workflowPath, 'utf-8');
        const lobster = LobsterConverter.parseSimpleYAML(content) as LobsterWorkflow;
        return LobsterValidator.validate(lobster);
      } catch (error) {
        return {
          valid: false,
          errors: [`Failed to parse YAML: ${(error as Error).message}`],
          warnings: []
        };
      }
    } else {
      // For Fishbone files, do basic validation
      try {
        const { parseFishboneFile } = require('./engine');
        const workflow = parseFishboneFile(workflowPath);
        
        if (!workflow.name) {
          return {
            valid: false,
            errors: ['Workflow name is required'],
            warnings: []
          };
        }
        
        if (!workflow.steps || workflow.steps.length === 0) {
          return {
            valid: false,
            errors: ['Workflow must have at least one step'],
            warnings: []
          };
        }
        
        return {
          valid: true,
          errors: [],
          warnings: []
        };
      } catch (error) {
        return {
          valid: false,
          errors: [`Failed to parse Fishbone file: ${(error as Error).message}`],
          warnings: []
        };
      }
    }
  }

  /**
   * Convert Lobster YAML to Fishbone format and save
   */
  static convertLobsterToFishboneFile(lobsterPath: string, fishbonePath: string): void {
    // Parse raw Lobster YAML (not converted to Fishbone)
    const content = fs.readFileSync(lobsterPath, 'utf-8');
    const lobster = LobsterConverter.parseSimpleYAML(content) as LobsterWorkflow;
    
    // Generate Fishbone markdown content
    let fishboneContent = `---
name: ${lobster.name}
description: ${lobster.description || ''}
version: ${lobster.version || '1.0.0'}
---

`;

    for (const step of lobster.steps) {
      fishboneContent += `## ${step.name}\n\n`;
      
      if (step.description) {
        fishboneContent += `${step.description}\n\n`;
      }
      
      // Map Lobster type to Fishbone action description
      let action = step.name;
      if (step.type === 'llm' && step.config?.prompt) {
        action = step.config.prompt;
      } else if ((step.type === 'tool' || step.type === 'function') && step.config?.tool) {
        action = `${step.config.tool} ${JSON.stringify(step.config.arguments || {})}`;
      } else if (step.type === 'http' && step.config?.url) {
        action = `${step.config.method || 'GET'} ${step.config.url}`;
      } else if (step.type === 'shell' && step.config?.command) {
        action = step.config.command;
      }
      
      fishboneContent += `- **Type**: ${step.type}\n`;
      fishboneContent += `- **Action**: ${action}\n`;
      
      if (step.approval?.required) {
        fishboneContent += `- **Approval**: required\n`;
      }
      
      if (step.retry) {
        fishboneContent += `- **Retry**: ${step.retry.maxAttempts || 3} attempts\n`;
      }
      
      if (step.inputs) {
        for (const [key, value] of Object.entries(step.inputs)) {
          fishboneContent += `- **Input**: ${key}=${value}\n`;
        }
      }
      
      if (step.outputs && step.outputs.length > 0) {
        for (const output of step.outputs) {
          fishboneContent += `- **Output**: ${output}\n`;
        }
      }
      
      if (step.dependsOn && step.dependsOn.length > 0) {
        fishboneContent += `- **DependsOn**: ${step.dependsOn.join(', ')}\n`;
      }
      
      fishboneContent += '\n';
    }

    fs.writeFileSync(fishbonePath, fishboneContent, 'utf-8');
  }

  /**
   * Get workflow metadata without full execution
   */
  static getWorkflowInfo(workflowPath: string): {
    name: string;
    description: string;
    version: string;
    stepCount: number;
    format: 'fishbone' | 'lobster';
  } {
    const extension = path.extname(workflowPath).toLowerCase();
    
    if (extension === '.yaml' || extension === '.yml') {
      // Parse Lobster YAML
      const content = fs.readFileSync(workflowPath, 'utf-8');
      const lobster = LobsterConverter.parseSimpleYAML(content) as LobsterWorkflow;
      
      return {
        name: lobster.name,
        description: lobster.description || '',
        version: lobster.version || '1.0.0',
        stepCount: lobster.steps?.length || 0,
        format: 'lobster'
      };
    } else {
      // Parse Fishbone
      const { parseFishboneFile } = require('./engine');
      const workflow = parseFishboneFile(workflowPath);
      
      return {
        name: workflow.name,
        description: workflow.description,
        version: workflow.version,
        stepCount: workflow.steps.length,
        format: 'fishbone'
      };
    }
  }
}

// ─── Utility Functions ─────────────────────────────────────────────────

/**
 * Check if a file is a Lobster YAML workflow
 */
export function isLobsterWorkflow(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return extension === '.yaml' || extension === '.yml';
}

/**
 * Create a sample Lobster YAML workflow
 */
export function createSampleLobsterWorkflow(): LobsterWorkflow {
  return {
    name: 'Sample Lobster Workflow',
    description: 'A sample workflow demonstrating Lobster YAML format',
    version: '1.0.0',
    metadata: {
      author: 'AZERCLAW',
      tags: ['sample', 'demo'],
      category: 'general'
    },
    triggers: [
      {
        type: 'manual',
        config: {}
      }
    ],
    variables: {
      input_text: 'Hello, world!',
      output_file: 'result.txt'
    },
    steps: [
      {
        id: 'step1',
        name: 'Process Input',
        description: 'Process the input text using LLM',
        type: 'llm',
        config: {
          prompt: 'Please process this text: {{input_text}}',
          model: 'gpt-4'
        },
        outputs: ['processed_text']
      },
      {
        id: 'step2',
        name: 'Save Result',
        description: 'Save the processed result to a file',
        type: 'shell',
        config: {
          command: 'echo "{{processed_text}}" > {{output_file}}'
        },
        dependsOn: ['step1']
      }
    ]
  };
}

/**
 * Save a Lobster workflow to file
 */
export function saveLobsterWorkflow(workflow: LobsterWorkflow, filePath: string): void {
  // Simple YAML output for demo purposes
  // In production, use proper yaml library
  let yamlContent = `name: ${workflow.name}\n`;
  if (workflow.description) yamlContent += `description: ${workflow.description}\n`;
  if (workflow.version) yamlContent += `version: ${workflow.version}\n`;
  
  yamlContent += 'steps:\n';
  for (const step of workflow.steps) {
    yamlContent += `  - id: ${step.id}\n`;
    yamlContent += `    name: ${step.name}\n`;
    yamlContent += `    type: ${step.type}\n`;
    if (step.description) yamlContent += `    description: ${step.description}\n`;
  }
  
  fs.writeFileSync(filePath, yamlContent, 'utf-8');
}
