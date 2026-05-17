/**
 * 🐟 AZERCLAW Smart Model Router
 * Task-aware routing with capability scoring and multi-model selection.
 */

import { BaseProvider, ModelInfo, TaskType, CompletionOptions, CompletionResult, StreamChunk } from '../providers/base';
import { getRouter, ProviderRouter } from '../providers/router';

// ─── Task Classifier ────────────────────────────────────────────

const TASK_KEYWORDS: Record<TaskType, string[]> = {
  code: ['code', 'function', 'bug', 'fix', 'refactor', 'implement', 'write', 'script', 'program', 'compile', 'syntax', 'error', 'test'],
  reasoning: ['explain', 'why', 'analyze', 'compare', 'evaluate', 'reason', 'logic', 'think', 'step by step', 'break down'],
  creative: ['write', 'story', 'poem', 'creative', 'design', 'draft', 'generate text', 'brainstorm', 'ideate'],
  search: ['search', 'find', 'look up', 'google', 'web', 'url', 'website', 'browse', 'fetch'],
  chat: ['hello', 'hi', 'hey', 'talk', 'chat', 'conversation', 'discuss'],
  planning: ['plan', 'decompose', 'break into', 'subtask', 'workflow', 'orchestrate', 'route'],
  synthesis: ['summarize', 'combine', 'merge', 'synthesize', 'consolidate', 'aggregate'],
};

export function classifyTask(prompt: string): TaskType {
  const lower = prompt.toLowerCase();
  const scores: Partial<Record<TaskType, number>> = {};

  for (const [task, keywords] of Object.entries(TASK_KEYWORDS)) {
    scores[task as TaskType] = keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0);
  }

  const sorted = (Object.entries(scores) as [TaskType, number][])
    .sort((a, b) => b[1] - a[1]);

  return sorted[0]?.[1] > 0 ? sorted[0][0] : 'chat';
}

// ─── Capability Map (hard-coded heuristics for free models) ─────

interface CapabilityProfile {
  strengths: TaskType[];
  latencyTier: 'fast' | 'normal' | 'slow';
  costTier: 'free' | 'rate_limited' | 'paid';
}

const DEFAULT_PROFILES: Record<string, CapabilityProfile> = {
  opencode: { strengths: ['code', 'reasoning', 'chat'], latencyTier: 'normal', costTier: 'free' },
  openrouter: { strengths: ['code', 'reasoning', 'creative', 'chat'], latencyTier: 'normal', costTier: 'free' },
  groq: { strengths: ['code', 'chat', 'planning'], latencyTier: 'fast', costTier: 'free' },
  pollinations: { strengths: ['creative', 'chat', 'search'], latencyTier: 'normal', costTier: 'free' },
  ollama: { strengths: ['code', 'chat', 'reasoning'], latencyTier: 'slow', costTier: 'free' },
  kiloauto: { strengths: ['code', 'reasoning', 'synthesis'], latencyTier: 'fast', costTier: 'free' },
  huggingface: { strengths: ['chat', 'creative'], latencyTier: 'slow', costTier: 'free' },
  localllama: { strengths: ['code', 'chat', 'reasoning'], latencyTier: 'slow', costTier: 'free' },
};

function enrichModelInfo(model: ModelInfo): ModelInfo {
  const profile = DEFAULT_PROFILES[model.provider];
  if (!profile) return model;
  return {
    ...model,
    strengths: model.strengths || profile.strengths,
    latencyTier: model.latencyTier || profile.latencyTier,
    costTier: model.costTier || profile.costTier,
  };
}

// ─── Router Score ───────────────────────────────────────────────

interface RouteScore {
  provider: string;
  model: ModelInfo;
  score: number;
}

function scoreModel(model: ModelInfo, task: TaskType, requireTools: boolean): number {
  const enriched = enrichModelInfo(model);
  let score = 0;

  // Task match
  if (enriched.strengths?.includes(task)) score += 30;
  else if (enriched.strengths?.some(s => ['chat', 'reasoning'].includes(s))) score += 10;

  // Tool support
  if (requireTools && enriched.supportsTools) score += 20;
  if (requireTools && !enriched.supportsTools) score -= 50;

  // Latency preference
  if (enriched.latencyTier === 'fast') score += 10;
  else if (enriched.latencyTier === 'slow') score -= 5;

  // Cost preference (always prefer free)
  if (enriched.costTier === 'free') score += 15;

  // Context window bonus for code/reasoning
  if ((task === 'code' || task === 'reasoning') && (enriched.contextWindow || 0) > 64000) {
    score += 5;
  }

  return score;
}

// ─── Smart Router ───────────────────────────────────────────────

export interface RouteOptions {
  task?: TaskType;
  requireTools?: boolean;
  topK?: number;
  preferStreaming?: boolean;
}

export class SmartModelRouter {
  private baseRouter: ProviderRouter;

  constructor(baseRouter?: ProviderRouter) {
    this.baseRouter = baseRouter || getRouter();
  }

  /**
   * Classify the task type from a user prompt.
   */
  classify(prompt: string): TaskType {
    return classifyTask(prompt);
  }

  /**
   * Score and rank all available models for a given task.
   */
  async rankModels(options: RouteOptions = {}): Promise<RouteScore[]> {
    const allModels = await this.baseRouter.listAllModels();
    const task = options.task || 'chat';
    const requireTools = options.requireTools ?? false;

    const scores: RouteScore[] = allModels.map(model => ({
      provider: model.provider,
      model: enrichModelInfo(model),
      score: scoreModel(model, task, requireTools),
    }));

    // Filter offline models, non-tool models when required, and prefer streaming
    const filtered = scores.filter(s => {
      if (s.model.status === 'offline') return false;
      if (requireTools && !s.model.supportsTools) return false;
      if (options.preferStreaming && !s.model.supportsStreaming) return false;
      return true;
    });

    return filtered.sort((a, b) => b.score - a.score);
  }

  /**
   * Select the single best model for a task.
   */
  async selectBest(options: RouteOptions = {}): Promise<{ provider: BaseProvider; model: ModelInfo } | undefined> {
    const ranked = await this.rankModels(options);
    if (ranked.length === 0) return undefined;

    const best = ranked[0];
    const provider = this.baseRouter.getProvider(best.provider);
    if (!provider) return undefined;

    return { provider, model: best.model };
  }

  /**
   * Select top K models for parallel execution.
   */
  async selectParallel(options: RouteOptions = {}): Promise<Array<{ provider: BaseProvider; model: ModelInfo }>> {
    const ranked = await this.rankModels(options);
    const topK = options.topK || 3;
    const selected: Array<{ provider: BaseProvider; model: ModelInfo }> = [];

    for (const route of ranked.slice(0, topK)) {
      const provider = this.baseRouter.getProvider(route.provider);
      if (provider) {
        selected.push({ provider, model: route.model });
      }
    }

    return selected;
  }

  /**
   * Complete using the best model for the task.
   */
  async complete(options: CompletionOptions, routeOptions?: RouteOptions): Promise<CompletionResult> {
    const task = routeOptions?.task || classifyTask(options.messages.map(m => m.content).join(' '));
    const best = await this.selectBest({ ...routeOptions, task });

    if (!best) {
      return {
        content: 'Error: No suitable AI model available for this task.',
        model: 'none',
        provider: 'none',
        finishReason: 'error',
      };
    }

    return best.provider.complete({ ...options, model: best.model.id });
  }

  /**
   * Stream using the best model for the task.
   */
  async *stream(options: CompletionOptions, routeOptions?: RouteOptions): AsyncGenerator<StreamChunk> {
    const task = routeOptions?.task || classifyTask(options.messages.map(m => m.content).join(' '));
    const best = await this.selectBest({ ...routeOptions, task, preferStreaming: true });

    if (!best) {
      yield { type: 'error', error: 'No suitable AI model available for this task.' };
      return;
    }

    yield* best.provider.stream({ ...options, model: best.model.id });
  }

  getBaseRouter(): ProviderRouter {
    return this.baseRouter;
  }
}
