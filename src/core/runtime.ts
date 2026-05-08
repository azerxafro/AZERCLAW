/**
 * 🐟 AZERCLAW Agent Runtime
 * Core autonomous agent loop with sub-agent spawning, tool execution,
 * approval gates, and multi-agent orchestration.
 */

import { getRouter } from '../providers/router';
import { getToolRegistry, ToolResult } from '../tools/registry';
import { getConfigManager } from '../config/manager';
import { ChatMessage, CompletionResult, ToolCall } from '../providers/base';

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

const DEFAULT_SYSTEM_PROMPT = `You are AZERCLAW 🐟, an autonomous AI agent running locally on the user's machine.

You are powerful, precise, and proactive. You have access to tools for:
- Running shell commands (run_shell)
- Reading files (read_file)
- Writing files (write_file)
- Listing directories (list_directory)
- Searching files (search_files)
- Spawning sub-agents for parallel tasks (spawn_sub_agent)

RULES:
1. Always use tools to accomplish tasks — don't just describe what you'd do.
2. Break complex tasks into steps and execute them sequentially.
3. For large/parallel workloads, spawn sub-agents to handle subtasks.
4. Always verify your work by reading back files you've written.
5. Be concise but thorough in your responses.
6. If a command might be destructive, explain what it does before running it.

You are running on: ${process.platform} (${process.arch})
Current directory: ${process.cwd()}`;

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
    this.context = {
      sessionId: options.sessionId || `session_${Date.now()}`,
      messages: [],
      systemPrompt: options.systemPrompt || DEFAULT_SYSTEM_PROMPT,
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
    let finalResponse = '';

    while (this.context.currentIteration < this.context.maxIterations && !this.aborted) {
      this.context.currentIteration++;
      await this.emit({ type: 'thinking' });

      const result = await router.complete({
        messages: this.context.messages,
        systemPrompt: this.context.systemPrompt,
        tools: registry.getDefinitions(),
        maxTokens: getConfigManager().getAll().ai.maxTokens || 2048,
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
          await this.emit({
            type: 'tool_call',
            toolName: toolCall.function.name,
            toolArgs: JSON.parse(toolCall.function.arguments || '{}'),
          });

          let toolResult: ToolResult;

          if (toolCall.function.name === 'spawn_sub_agent') {
            toolResult = await this.handleSubAgent(toolCall);
          } else {
            toolResult = await registry.execute(
              toolCall.function.name,
              JSON.parse(toolCall.function.arguments || '{}')
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
    const args = JSON.parse(toolCall.function.arguments || '{}');
    const subAgentId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    await this.emit({ type: 'sub_agent_spawn', subAgentId, content: args.task });

    const subAgent = new AgentRuntime({
      sessionId: subAgentId,
      systemPrompt: args.systemPrompt || this.context.systemPrompt,
      maxIterations: args.maxIterations || 10,
      parentAgentId: this.context.sessionId,
      eventHandler: async (event) => {
        // Prefix sub-agent events
        await this.emit({ ...event, subAgentId });
      },
    });

    this.subAgents.set(subAgentId, subAgent);

    try {
      const result = await subAgent.run(args.task);
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

  private async emit(event: AgentEvent): Promise<void> {
    await this.eventHandler(event);
  }
}
