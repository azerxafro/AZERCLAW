/**
 * 🐟 AZERCLAW Hybrid Execution Engine
 * Decomposes tasks, routes subtasks to best free models in parallel,
 * and synthesizes results into a coherent final response.
 */

import { AgentRuntime, AgentEvent } from '../core/runtime';
import { SmartModelRouter, classifyTask, RouteOptions } from './router';
import { getAdapter } from './adapters';
import { CompletionOptions, CompletionResult, ChatMessage } from '../providers/base';
import { getRouter } from '../providers/router';

// ─── Types ──────────────────────────────────────────────────────

export interface SubTask {
  id: string;
  description: string;
  taskType: string;
  dependencies: string[]; // IDs of subtasks this one depends on
}

export interface DecompositionResult {
  subtasks: SubTask[];
  requiresParallel: boolean;
  complexity: 'simple' | 'moderate' | 'complex';
}

export interface HybridEvent {
  type: 'decompose' | 'dispatch' | 'subtask_start' | 'subtask_done' | 'synthesize' | 'response' | 'error' | 'done';
  content?: string;
  subtaskId?: string;
  error?: string;
}

export type HybridEventHandler = (event: HybridEvent) => void | Promise<void>;

// ─── Task Decomposer ────────────────────────────────────────────

const DECOMPOSE_PROMPT = `You are a task decomposition engine. Analyze the user's request and break it into independent subtasks that can be executed in parallel by different AI models.

Rules:
1. Each subtask must be self-contained and executable independently (unless it has dependencies).
2. Assign a task type to each subtask: code, reasoning, creative, search, chat.
3. If the request is simple (single question, greeting, one-step task), return ONE subtask with complexity "simple".
4. Output ONLY a JSON object in this exact format (no markdown, no extra text):

{
  "complexity": "simple" | "moderate" | "complex",
  "subtasks": [
    { "id": "1", "description": "...", "taskType": "code", "dependencies": [] },
    { "id": "2", "description": "...", "taskType": "reasoning", "dependencies": ["1"] }
  ]
}

User request:`;

async function decomposeTask(request: string): Promise<DecompositionResult> {
  const router = getRouter();

  // Use a fast provider for planning (prefer groq or opencode)
  const plannerProvider = router.getProvider('groq') || router.getProvider('opencode') || router.getProvider();
  if (!plannerProvider) {
    return { subtasks: [{ id: '1', description: request, taskType: classifyTask(request), dependencies: [] }], requiresParallel: false, complexity: 'simple' };
  }

  try {
    const result = await plannerProvider.complete({
      messages: [{ role: 'user', content: request }],
      systemPrompt: DECOMPOSE_PROMPT,
      maxTokens: 1024,
      temperature: 0.3,
    });

    if (result.finishReason === 'error') {
      // Fallback: single task
      return { subtasks: [{ id: '1', description: request, taskType: classifyTask(request), dependencies: [] }], requiresParallel: false, complexity: 'simple' };
    }

    const text = result.content.trim();
    // Extract JSON from possible markdown fences
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { subtasks: [{ id: '1', description: request, taskType: classifyTask(request), dependencies: [] }], requiresParallel: false, complexity: 'simple' };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const subtasks: SubTask[] = (parsed.subtasks || []).map((st: any) => ({
      id: String(st.id),
      description: String(st.description),
      taskType: String(st.taskType || 'chat'),
      dependencies: Array.isArray(st.dependencies) ? st.dependencies.map(String) : [],
    }));

    const complexity = parsed.complexity === 'moderate' || parsed.complexity === 'complex'
      ? parsed.complexity
      : 'simple';

    return {
      subtasks: subtasks.length > 0 ? subtasks : [{ id: '1', description: request, taskType: classifyTask(request), dependencies: [] }],
      requiresParallel: complexity !== 'simple' && subtasks.length > 1,
      complexity,
    };
  } catch {
    // On any failure, fall back to simple single-task mode
    return { subtasks: [{ id: '1', description: request, taskType: classifyTask(request), dependencies: [] }], requiresParallel: false, complexity: 'simple' };
  }
}

// ─── Result Synthesizer ─────────────────────────────────────────

const SYNTHESIZE_PROMPT = `You are a result synthesizer. Combine the outputs from multiple AI sub-agents into a single, coherent, well-structured final response.

Rules:
1. Remove duplicate information.
2. Resolve any contradictions by favoring the most detailed or most confident answer.
3. Maintain the original tone and intent of the user's request.
4. If subtasks produced code, format it properly with markdown code blocks.
5. Be concise but complete.

Subtask outputs:`;

async function synthesizeResults(originalRequest: string, results: Array<{ subtask: SubTask; output: string }>): Promise<string> {
  const router = getRouter();
  const synthesizerProvider = router.getProvider('opencode') || router.getProvider('groq') || router.getProvider();
  if (!synthesizerProvider) {
    return results.map(r => `### ${r.subtask.description}\n${r.output}`).join('\n\n---\n\n');
  }

  const subtaskText = results.map((r, i) =>
    `--- Subtask ${i + 1} (${r.subtask.taskType}): ${r.subtask.description} ---\n${r.output}`
  ).join('\n\n');

  try {
    const result = await synthesizerProvider.complete({
      messages: [
        { role: 'system', content: SYNTHESIZE_PROMPT },
        { role: 'user', content: `Original request: ${originalRequest}\n\n${subtaskText}` },
      ],
      maxTokens: 4096,
      temperature: 0.5,
    });

    if (result.finishReason === 'error') {
      // Fallback: simple concatenation
      return results.map(r => `### ${r.subtask.description}\n${r.output}`).join('\n\n---\n\n');
    }

    return result.content;
  } catch {
    return results.map(r => `### ${r.subtask.description}\n${r.output}`).join('\n\n---\n\n');
  }
}

// ─── Hybrid Engine ──────────────────────────────────────────────

export class HybridEngine {
  private smartRouter: SmartModelRouter;
  private eventHandler?: HybridEventHandler;
  private aborted = false;

  constructor(options?: { smartRouter?: SmartModelRouter; eventHandler?: HybridEventHandler }) {
    this.smartRouter = options?.smartRouter || new SmartModelRouter();
    this.eventHandler = options?.eventHandler;
  }

  /**
   * Execute a user request through the hybrid engine.
   * Returns the final synthesized response.
   */
  async execute(request: string, flags: string[] = []): Promise<string> {
    this.aborted = false;

    // ─── Step 1: Decompose ───
    await this.emit({ type: 'decompose', content: 'Analyzing task complexity...' });
    const decomposition = await decomposeTask(request);

    if (this.aborted) {
      return 'Execution aborted.';
    }

    // Simple tasks bypass hybrid and go straight to single AgentRuntime
    if (!decomposition.requiresParallel || decomposition.complexity === 'simple') {
      return this.runSimple(request, flags);
    }

    // ─── Step 2: Dispatch subtasks in parallel respecting dependencies ───
    await this.emit({ type: 'dispatch', content: `Dispatching ${decomposition.subtasks.length} subtasks...` });

    const completedResults = new Map<string, { subtask: SubTask; output: string }>();
    const pending = new Set(decomposition.subtasks);

    while (pending.size > 0 && !this.aborted) {
      // Find subtasks whose dependencies are all satisfied
      const ready = Array.from(pending).filter(st =>
        st.dependencies.every(depId => completedResults.has(depId))
      );

      if (ready.length === 0) {
        // Deadlock or circular dependency — just run remaining
        pending.forEach(st => ready.push(st));
        pending.clear();
      }

      // Run ready subtasks in parallel
      const batchPromises = ready.map(async (subtask) => {
        await this.emit({ type: 'subtask_start', subtaskId: subtask.id, content: subtask.description });

        // Build context from dependencies
        const depContext = subtask.dependencies
          .map(depId => {
            const dep = completedResults.get(depId);
            return dep ? `Context from previous step (${dep.subtask.description}):\n${dep.output}` : '';
          })
          .filter(Boolean)
          .join('\n\n');

        const taskPrompt = depContext
          ? `${subtask.description}\n\n${depContext}`
          : subtask.description;

        const output = await this.runSubtask(taskPrompt, subtask.taskType as any, flags);

        await this.emit({ type: 'subtask_done', subtaskId: subtask.id, content: output.slice(0, 200) });
        completedResults.set(subtask.id, { subtask, output });
      });

      await Promise.all(batchPromises);
      ready.forEach(st => pending.delete(st));
    }

    if (this.aborted) {
      return 'Execution aborted.';
    }

    // ─── Step 3: Synthesize ───
    await this.emit({ type: 'synthesize', content: 'Synthesizing results...' });
    const results = decomposition.subtasks.map(st => completedResults.get(st.id)!);
    const finalResponse = await synthesizeResults(request, results);

    await this.emit({ type: 'response', content: finalResponse });
    await this.emit({ type: 'done' });

    return finalResponse;
  }

  /**
   * Run a single subtask with the best model for its task type.
   */
  private async runSubtask(taskPrompt: string, taskType: string, flags: string[]): Promise<string> {
    const routeOptions: RouteOptions = { task: taskType as any };
    const best = await this.smartRouter.selectBest(routeOptions);

    if (!best) {
      // Ultimate fallback: standard AgentRuntime
      return this.runWithAgentRuntime(taskPrompt, flags);
    }

    const adapter = getAdapter(best.provider.name);

    // For providers needing tool injection, we could modify the prompt here.
    // For now, we run a lightweight completion.
    const messages: ChatMessage[] = [{ role: 'user', content: taskPrompt }];

    try {
      const result = await best.provider.complete({
        messages,
        maxTokens: 2048,
        temperature: 0.7,
      });

      if (result.finishReason === 'error') {
        // Fallback to AgentRuntime if the provider fails
        return this.runWithAgentRuntime(taskPrompt, flags);
      }

      // Parse tool calls if adapter requires injection
      if (adapter.requiresInjection()) {
        const parsed = adapter.parseResponse(result.content);
        if (parsed.toolCalls && parsed.toolCalls.length > 0) {
          // For now, subtasks are meant to be reasoning-only.
          // We return the text content; tool execution is handled by the main agent.
          return parsed.content || result.content;
        }
      }

      return result.content;
    } catch {
      return this.runWithAgentRuntime(taskPrompt, flags);
    }
  }

  /**
   * Fallback: run with the existing AgentRuntime (single model, full tool loop).
   */
  private async runWithAgentRuntime(prompt: string, flags: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const agent = new AgentRuntime({
        sessionId: `hybrid_${Date.now()}`,
        flags,
        eventHandler: async (event: AgentEvent) => {
          // Forward relevant events to hybrid handler
          if (event.type === 'response' && this.eventHandler) {
            await this.emit({ type: 'response', content: event.content });
          }
          if (event.type === 'done') {
            resolve(event.content || '');
          } else if (event.type === 'error') {
            reject(new Error(event.error || 'Agent error'));
          }
        },
      });
      agent.run(prompt).then(resolve).catch(reject);
    });
  }

  /**
   * Simple mode: directly use AgentRuntime for straightforward requests.
   */
  private async runSimple(request: string, flags: string[]): Promise<string> {
    const result = await this.runWithAgentRuntime(request, flags);
    await this.emit({ type: 'done' });
    return result;
  }

  abort(): void {
    this.aborted = true;
  }

  private async emit(event: HybridEvent): Promise<void> {
    if (this.eventHandler) {
      await this.eventHandler(event);
    }
  }
}
