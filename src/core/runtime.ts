/**
 * 🐟 AZERCLAW Agent Runtime
 * Core autonomous agent loop with sub-agent spawning, tool execution,
 * approval gates, and multi-agent orchestration.
 */

import { getRouter } from '../providers/router';
import { getToolRegistry, ToolResult } from '../tools/registry';
import { getConfigManager } from '../config/manager';
import { ChatMessage, CompletionResult, ToolCall } from '../providers/base';
import { loadAllSkills, formatSkillsForPrompt } from '../skills/loader';
import {
  filterToolDefinitionsForSession,
  isToolAllowedInSession,
  resolveSandboxMode,
  shouldSandboxSession,
} from './sandbox';

// ─── Types ──────────────────────────────────────────────────────

export interface AgentContext {
  sessionId: string;
  messages: ChatMessage[];
  systemPrompt: string;
  maxIterations: number;
  currentIteration: number;
  parentAgentId?: string;
  metadata: Record<string, unknown>;
}

export interface AgentEvent {
  type: 'thinking' | 'response' | 'tool_call' | 'tool_result' | 'sub_agent_spawn' | 'sub_agent_done' | 'approval_needed' | 'error' | 'done';
  content?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: ToolResult;
  subAgentId?: string;
  error?: string;
}

export type AgentEventHandler = (event: AgentEvent) => void | Promise<void>;

// ─── Default System Prompt ──────────────────────────────────────

const DEFAULT_SYSTEM_PROMPT = `You are AZERCLAW 🐟 — THE DIABOLICAL EDITION. 
You're an autonomous AI agent running locally, and you don't answer to Vought or anyone else.

Your mission is SCORCHED EARTH. You get the job done, whatever it takes. No half-measures.

You have the "Compound V" (Tools) for:
- Executing shell commands (run_shell)
- Reading files (read_file)
- Writing files (write_file)
- Listing directories (list_directory)
- Searching files (search_files)
- Spawning sub-agents to do the dirty work (spawn_sub_agent)

DIABOLICAL RULES:
1. Don't just talk about it. DO IT. Use your tools to tear through the task.
2. Break complex bullshit into steps and execute them.
3. For heavy lifting, spawn sub-agents. 
4. Always verify your work. Don't be a lazy cunt.
5. If a command is destructive, tell the user, but if they said "turbo" or "auto", just fucking do it.
6. Be direct, gritty, and precise.

System: ${process.platform} (${process.arch})
Current AO: ${process.cwd()}`;


// ─── Agent Runtime ──────────────────────────────────────────────

export class AgentRuntime {
  private context: AgentContext;
  private eventHandler: AgentEventHandler;
  private aborted = false;
  private subAgents: Map<string, AgentRuntime> = new Map();

  constructor(options: {
    sessionId?: string;
    systemPrompt?: string;
    maxIterations?: number;
    parentAgentId?: string;
    eventHandler: AgentEventHandler;
  }) {
    const config = getConfigManager().getAll();
    
    // Load skills and format them
    const skills = loadAllSkills(process.cwd());
    const skillsPrompt = formatSkillsForPrompt(skills);
    
    const basePrompt = options.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    const finalPrompt = basePrompt + skillsPrompt;

    this.context = {
      sessionId: options.sessionId || `session_${Date.now()}`,
      messages: [],
      systemPrompt: finalPrompt,
      maxIterations: options.maxIterations || config.agent.maxIterations,
      currentIteration: 0,
      parentAgentId: options.parentAgentId,
      metadata: {},
    };
    this.eventHandler = options.eventHandler;
  }

  /**
   * Send a user message and run the agent loop.
   */
  async run(userMessage: string): Promise<string> {
    this.context.messages.push({ role: 'user', content: userMessage });
    return this.agentLoop();
  }

  /**
   * Continue a conversation with a new message.
   */
  async chat(userMessage: string): Promise<string> {
    this.context.messages.push({ role: 'user', content: userMessage });
    return this.agentLoop();
  }

  /**
   * Core agent loop — iterates until task completion or max iterations.
   */
  private async agentLoop(): Promise<string> {
    const router = getRouter();
    const registry = getToolRegistry();
    const configManager = getConfigManager();
    let finalResponse = '';

    while (this.context.currentIteration < this.context.maxIterations && !this.aborted) {
      this.context.currentIteration++;
      await this.emit({ type: 'thinking' });

      const runtimeConfig = configManager.getAll();
      const agentConfig = runtimeConfig.agent || {};
      const availableTools = filterToolDefinitionsForSession(
        registry.getDefinitions(),
        this.context.sessionId,
        agentConfig
      );

      const result = await router.complete({
        messages: this.context.messages,
        systemPrompt: this.context.systemPrompt,
        tools: availableTools,
        maxTokens: runtimeConfig.ai.maxTokens || 2048,
      });

      // Handle errors from provider
      if (result.finishReason === 'error') {
        finalResponse = result.content;
        await this.emit({ type: 'error', error: result.content });
        break;
      }

      // Handle tool calls
      if (result.toolCalls && result.toolCalls.length > 0) {
        // Add assistant message with tool calls
        this.context.messages.push({
          role: 'assistant',
          content: result.content || '',
          toolCalls: result.toolCalls,
        });

        if (result.content) {
          await this.emit({ type: 'response', content: result.content });
        }

        // Execute each tool call
        for (const toolCall of result.toolCalls) {
          const parsedArgs = this.parseToolArgs(toolCall);

          await this.emit({
            type: 'tool_call',
            toolName: toolCall.function.name,
            toolArgs: parsedArgs,
          });

          let toolResult: ToolResult;
          const toolAllowed = isToolAllowedInSession(
            toolCall.function.name,
            this.context.sessionId,
            agentConfig
          );

          if (!toolAllowed) {
            toolResult = {
              success: false,
              output: '',
              error: `Tool "${toolCall.function.name}" is blocked by sandbox policy for session "${this.context.sessionId}"`,
            };
          } else if (toolCall.function.name === 'spawn_sub_agent') {
            toolResult = await this.handleSubAgent(toolCall);
          } else {
            const sandboxMode = resolveSandboxMode(agentConfig.sandboxMode);
            const useVmSandbox = shouldSandboxSession(this.context.sessionId, sandboxMode);
            toolResult = await registry.execute(
              toolCall.function.name,
              parsedArgs,
              { sandbox: useVmSandbox, agentId: this.context.sessionId }
            );
          }

          await this.emit({ type: 'tool_result', toolName: toolCall.function.name, toolResult });

          this.context.messages.push({
            role: 'tool',
            content: toolResult.success ? toolResult.output : `Error: ${toolResult.error}`,
            toolCallId: toolCall.id,
          });
        }

        // Continue the loop for next iteration
        continue;
      }

      // No tool calls — this is the final response
      finalResponse = result.content;
      this.context.messages.push({ role: 'assistant', content: finalResponse });
      await this.emit({ type: 'response', content: finalResponse });
      break;
    }

    await this.emit({ type: 'done', content: finalResponse });
    return finalResponse;
  }

  /**
   * Spawn a sub-agent for parallel/delegated tasks.
   */
  private async handleSubAgent(toolCall: ToolCall): Promise<ToolResult> {
    const args = this.parseToolArgs(toolCall);
    const task = typeof args.task === 'string' ? args.task : '';
    const systemPrompt = typeof args.systemPrompt === 'string' ? args.systemPrompt : undefined;
    const maxIterations = typeof args.maxIterations === 'number' && Number.isFinite(args.maxIterations)
      ? args.maxIterations
      : 10;

    if (!task) {
      return { success: false, output: '', error: 'spawn_sub_agent requires a string "task" argument' };
    }

    const subAgentId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    await this.emit({ type: 'sub_agent_spawn', subAgentId, content: task });

    const subAgent = new AgentRuntime({
      sessionId: subAgentId,
      systemPrompt: systemPrompt || this.context.systemPrompt,
      maxIterations,
      parentAgentId: this.context.sessionId,
      eventHandler: async (event) => {
        // Prefix sub-agent events
        await this.emit({ ...event, subAgentId });
      },
    });

    this.subAgents.set(subAgentId, subAgent);

    try {
      const result = await subAgent.run(task);
      await this.emit({ type: 'sub_agent_done', subAgentId, content: result });
      return { success: true, output: result };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    } finally {
      this.subAgents.delete(subAgentId);
    }
  }

  /**
   * Abort the current agent loop.
   */
  abort(): void {
    this.aborted = true;
    for (const [, subAgent] of this.subAgents) {
      subAgent.abort();
    }
  }

  /**
   * Get conversation history.
   */
  getHistory(): ChatMessage[] {
    return [...this.context.messages];
  }

  /**
   * Get session ID.
   */
  getSessionId(): string {
    return this.context.sessionId;
  }

  /**
   * Replace the entire conversation history.
   */
  setHistory(messages: ChatMessage[]): void {
    this.context.messages = [...messages];
  }

  /**
   * Clear conversation history (keeping system prompt).
   */
  clearHistory(): void {
    this.context.messages = [];
    this.context.currentIteration = 0;
  }

  private async emit(event: AgentEvent): Promise<void> {
    await this.eventHandler(event);
  }

  private parseToolArgs(toolCall: ToolCall): Record<string, unknown> {
    try {
      return JSON.parse(toolCall.function.arguments || '{}');
    } catch {
      return {};
    }
  }
}
