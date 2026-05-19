/**
 * 🐟 AZERCLAW Fishbone Workflow Engine
 * Deterministic, typed pipeline system — replaces Azerclaw's "Fishbone" engine.
 * Supports .fishbone files for defining multi-step workflows with approval gates.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { AgentRuntime, AgentEvent } from '../core/runtime';
import { auditLog, getSafeEnv } from '../core/security';

// ─── Types ──────────────────────────────────────────────────────

export interface FishboneStep {
  id: string;
  name: string;
  type: 'agent' | 'shell' | 'condition' | 'approval' | 'parallel' | 'transform';
  action: string;
  inputs?: Record<string, string>;
  outputs?: string[];
  requiresApproval?: boolean;
  onError?: 'stop' | 'continue' | 'retry';
  maxRetries?: number;
  timeout?: number;             // ms
  children?: FishboneStep[];    // For parallel steps
}

export interface FishboneWorkflow {
  name: string;
  description: string;
  version: string;
  trigger?: string;
  variables: Record<string, string>;
  steps: FishboneStep[];
}

export interface WorkflowExecution {
  id: string;
  workflowName: string;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'awaiting_approval';
  currentStepId: string;
  results: Record<string, string>;
  resumeToken?: string;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export type WorkflowEventHandler = (event: {
  type: 'step_start' | 'step_complete' | 'step_error' | 'approval_needed' | 'workflow_complete' | 'workflow_error';
  stepId?: string;
  stepName?: string;
  content?: string;
  resumeToken?: string;
}) => void | Promise<void>;

// ─── .fishbone File Parser ──────────────────────────────────────

export function parseFishboneFile(filePath: string): FishboneWorkflow {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Parse YAML-like frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  
  let metadata: Record<string, string> = {};
  let body = content;
  
  if (fmMatch) {
    for (const line of fmMatch[1].split('\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        metadata[key] = value;
      }
    }
    body = fmMatch[2];
  }
  
  // Parse steps from markdown sections
  const steps: FishboneStep[] = [];
  const stepSections = body.split(/^## /m).slice(1);
  
  for (let i = 0; i < stepSections.length; i++) {
    const section = stepSections[i];
    const lines = section.split('\n');
    const name = lines[0].trim();
    
    let type: FishboneStep['type'] = 'agent';
    let action = '';
    let requiresApproval = false;
    let onError: FishboneStep['onError'] = 'stop';
    const inputs: Record<string, string> = {};
    const outputs: string[] = [];
    
    for (const line of lines.slice(1)) {
      const t = line.trim();
      if (t.startsWith('- **Type**:')) {
        type = t.replace('- **Type**:', '').trim() as FishboneStep['type'];
      } else if (t.startsWith('- **Action**:')) {
        action = t.replace('- **Action**:', '').trim();
      } else if (t.startsWith('- **Approval**:')) {
        requiresApproval = t.replace('- **Approval**:', '').trim().toLowerCase() === 'required';
      } else if (t.startsWith('- **OnError**:')) {
        onError = t.replace('- **OnError**:', '').trim() as FishboneStep['onError'];
      } else if (t.startsWith('- **Input**:')) {
        const kv = t.replace('- **Input**:', '').trim().split('=');
        if (kv.length === 2) inputs[kv[0].trim()] = kv[1].trim();
      } else if (t.startsWith('- **Output**:')) {
        outputs.push(t.replace('- **Output**:', '').trim());
      } else if (!t.startsWith('-') && !t.startsWith('#') && t.length > 0 && !action) {
        action = t;
      }
    }
    
    steps.push({
      id: `step_${i + 1}`,
      name,
      type,
      action: action || name,
      inputs: Object.keys(inputs).length > 0 ? inputs : undefined,
      outputs: outputs.length > 0 ? outputs : undefined,
      requiresApproval,
      onError,
    });
  }
  
  return {
    name: metadata['name'] || path.basename(filePath, '.fishbone'),
    description: metadata['description'] || '',
    version: metadata['version'] || '1.0.0',
    trigger: metadata['trigger'],
    variables: {},
    steps,
  };
}

// ─── Fishbone Engine ────────────────────────────────────────────

export class FishboneEngine {
  private executions: Map<string, WorkflowExecution> = new Map();

  /**
   * Execute a workflow from a .fishbone file.
   */
  async execute(
    workflow: FishboneWorkflow,
    variables: Record<string, string> = {},
    eventHandler?: WorkflowEventHandler
  ): Promise<WorkflowExecution> {
    const executionId = crypto.randomUUID();
    
    const execution: WorkflowExecution = {
      id: executionId,
      workflowName: workflow.name,
      status: 'running',
      currentStepId: '',
      results: { ...variables },
      startedAt: new Date(),
    };
    
    this.executions.set(executionId, execution);
    auditLog('WORKFLOW_START', `${workflow.name} (${executionId})`);
    
    try {
      for (const step of workflow.steps) {
        execution.currentStepId = step.id;
        
        await eventHandler?.({
          type: 'step_start',
          stepId: step.id,
          stepName: step.name,
        });
        
        // Handle approval gates
        if (step.requiresApproval) {
          const resumeToken = crypto.randomBytes(16).toString('hex');
          execution.status = 'awaiting_approval';
          execution.resumeToken = resumeToken;
          
          await eventHandler?.({
            type: 'approval_needed',
            stepId: step.id,
            stepName: step.name,
            content: step.action,
            resumeToken,
          });
          
          auditLog('WORKFLOW_APPROVAL', `${step.name} — awaiting approval`);
          // In a real implementation, this would pause and wait for resume
          // For now, we auto-approve
          execution.status = 'running';
        }
        
        // Execute step based on type
        let stepResult = '';
        
        try {
          switch (step.type) {
            case 'shell': {
              const { exec } = require('child_process');
              const util = require('util');
              const execPromise = util.promisify(exec);
              const cmd = this.interpolate(step.action, execution.results);
              const { stdout } = await execPromise(cmd, {
                encoding: 'utf-8',
                timeout: step.timeout || 30000,
                env: getSafeEnv()
              });
              stepResult = stdout.trim();
              break;
            }
            
            case 'agent': {
              const action = this.interpolate(step.action, execution.results);
              const agent = new AgentRuntime({
                sessionId: `fishbone_${executionId}_${step.id}`,
                maxIterations: 10,
                eventHandler: async () => {},
              });
              stepResult = await agent.run(action);
              break;
            }
            
            case 'condition': {
              const condition = this.interpolate(step.action, execution.results);
              const { exec } = require('child_process');
              const util = require('util');
              const execPromise = util.promisify(exec);
              try {
                await execPromise(condition, {
                  encoding: 'utf-8',
                  timeout: 5000,
                  env: getSafeEnv()
                });
                stepResult = 'true';
              } catch {
                stepResult = 'false';
              }
              break;
            }
            
            case 'transform': {
              stepResult = this.interpolate(step.action, execution.results);
              break;
            }
            
            case 'parallel': {
              if (step.children) {
                const results = await Promise.all(
                  step.children.map(async (child) => {
                    const agent = new AgentRuntime({
                      sessionId: `fishbone_${executionId}_${child.id}`,
                      maxIterations: 5,
                      eventHandler: async () => {},
                    });
                    return agent.run(child.action);
                  })
                );
                stepResult = results.join('\n---\n');
              }
              break;
            }
          }
        } catch (e: any) {
          if (step.onError === 'continue') {
            stepResult = `Error (continuing): ${e.message}`;
          } else if (step.onError === 'retry' && (step.maxRetries || 0) > 0) {
            // Retry logic — only safe for shell steps (which we know are commands).
            // For other step types we'd need to re-run the typed handler; abandon retry
            // rather than blindly execSync-ing arbitrary action text.
            let retried = false;
            if (step.type === 'shell') {
              const { exec } = require('child_process');
              const util = require('util');
              const execPromise = util.promisify(exec);
              const cmd = this.interpolate(step.action, execution.results);
              for (let r = 0; r < (step.maxRetries || 1); r++) {
                try {
                  const { stdout } = await execPromise(cmd, {
                    encoding: 'utf-8',
                    timeout: step.timeout || 30000,
                    env: getSafeEnv()
                  });
                  stepResult = stdout.trim();
                  retried = true;
                  break;
                } catch { continue; }
              }
            }
            if (!retried) {
              stepResult = `Retry skipped (unsupported for type=${step.type}): ${e.message}`;
            }
          } else {
            throw e;
          }
        }
        
        // Store result
        execution.results[step.id] = stepResult;
        if (step.outputs) {
          for (const output of step.outputs) {
            execution.results[output] = stepResult;
          }
        }
        
        await eventHandler?.({
          type: 'step_complete',
          stepId: step.id,
          stepName: step.name,
          content: stepResult.slice(0, 200),
        });
      }
      
      execution.status = 'completed';
      execution.completedAt = new Date();
      auditLog('WORKFLOW_DONE', `${workflow.name} — completed`);
      
      await eventHandler?.({ type: 'workflow_complete', content: 'All steps completed' });
      
    } catch (e: any) {
      execution.status = 'failed';
      execution.error = e.message;
      execution.completedAt = new Date();
      auditLog('WORKFLOW_ERROR', `${workflow.name} — ${e.message}`);
      
      await eventHandler?.({ type: 'workflow_error', content: e.message });
    }
    
    return execution;
  }

  /**
   * Resume a paused workflow with a resume token.
   */
  async resume(executionId: string, resumeToken: string): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (!execution) return false;
    if (execution.resumeToken !== resumeToken) return false;
    
    execution.status = 'running';
    execution.resumeToken = undefined;
    auditLog('WORKFLOW_RESUMED', executionId);
    return true;
  }

  /**
   * Get execution status.
   */
  getExecution(id: string): WorkflowExecution | undefined {
    return this.executions.get(id);
  }

  /**
   * Interpolate variables in a string: {{varName}} → value
   */
  private interpolate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`);
  }
}
