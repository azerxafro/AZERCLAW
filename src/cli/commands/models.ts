/**
 * 🐟 AZERCLAW Models Command
 * List and manage AI models across all providers.
 * Enhanced with free model registry for zero-cost AI access.
 */

import chalk from 'chalk';
import gradientString from 'gradient-string';
import { getRouter, resetRouter } from '../../providers/router';
import { getConfigManager } from '../../config/manager';
import { ProviderName } from '../../config/schema';
import { fishSuccess, fishInfo, fishBox, FishThinkingAnimation } from '../animations/fish';

const LUXE = gradientString(['#c084fc', '#818cf8', '#60a5fa', '#34d399']);
const FIRE = gradientString(['#f59e0b', '#ef4444', '#ec4899']);

// 🆓 FREE MODEL REGISTRY - Known free models across providers
const FREE_MODEL_REGISTRY = {
  pollinations: [
    { id: 'openai', name: 'GPT-4o-mini', contextWindow: 128000, supportsTools: true, supportsStreaming: true, description: '🆓 No API key needed · GPT-4o-mini via Pollinations' },
    { id: 'anthropic', name: 'Claude 3 Haiku', contextWindow: 200000, supportsTools: true, supportsStreaming: true, description: '🆓 No API key needed · Claude 3 Haiku via Pollinations' },
    { id: 'deepseek', name: 'DeepSeek V3', contextWindow: 64000, supportsTools: true, supportsStreaming: true, description: '🆓 No API key needed · DeepSeek V3 via Pollinations' },
    { id: 'mistral', name: 'Mistral Large', contextWindow: 32000, supportsTools: true, supportsStreaming: true, description: '🆓 No API key needed · Mistral Large via Pollinations' },
    { id: 'llama', name: 'Llama 3.3 70B', contextWindow: 128000, supportsTools: true, supportsStreaming: true, description: '🆓 No API key needed · Llama 3.3 70B via Pollinations' },
  ],
  openrouter: [
    { id: 'deepseek/deepseek-chat:free', name: 'DeepSeek V3', contextWindow: 64000, supportsTools: true, supportsStreaming: true, description: '🆓 FREE tier · DeepSeek V3 685B params' },
    { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash', contextWindow: 1000000, supportsTools: true, supportsStreaming: true, description: '🆓 FREE tier · 1M context window' },
    { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', contextWindow: 128000, supportsTools: true, supportsStreaming: true, description: '🆓 FREE tier · Latest Llama 70B' },
    { id: 'nvidia/llama-3.1-nemotron-70b-instruct:free', name: 'Nemotron 70B', contextWindow: 128000, supportsTools: true, supportsStreaming: true, description: '🆓 FREE tier · NVIDIA optimized 70B' },
    { id: 'qwen/qwen-2.5-72b-instruct:free', name: 'Qwen 2.5 72B', contextWindow: 128000, supportsTools: true, supportsStreaming: true, description: '🆓 FREE tier · Alibaba Qwen 72B' },
    { id: 'microsoft/phi-3-medium-128k-instruct:free', name: 'Phi 3 Medium', contextWindow: 128000, supportsTools: true, supportsStreaming: true, description: '🆓 FREE tier · Microsoft Phi-3' },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', contextWindow: 128000, supportsTools: true, supportsStreaming: true, description: '🆓 Generous free tier · 8K tokens/min' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', contextWindow: 128000, supportsTools: true, supportsStreaming: true, description: '🆓 Generous free tier · Fast inference' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', contextWindow: 32768, supportsTools: true, supportsStreaming: true, description: '🆓 Generous free tier · MoE architecture' },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B', contextWindow: 8000, supportsTools: true, supportsStreaming: true, description: '🆓 Generous free tier · Google Gemma 2' },
  ],
  ollama: [
    { id: 'llama3.2', name: 'Llama 3.2', contextWindow: 128000, supportsTools: false, supportsStreaming: true, description: '🏠 Local · Meta Llama 3.2 (3B)' },
    { id: 'llama3.1', name: 'Llama 3.1', contextWindow: 128000, supportsTools: false, supportsStreaming: true, description: '🏠 Local · Meta Llama 3.1 (8B)' },
    { id: 'qwen2.5', name: 'Qwen 2.5', contextWindow: 128000, supportsTools: false, supportsStreaming: true, description: '🏠 Local · Alibaba Qwen 2.5' },
    { id: 'phi4', name: 'Phi 4', contextWindow: 16000, supportsTools: false, supportsStreaming: true, description: '🏠 Local · Microsoft Phi 4' },
    { id: 'deepseek-r1', name: 'DeepSeek R1', contextWindow: 64000, supportsTools: false, supportsStreaming: true, description: '🏠 Local · DeepSeek R1 reasoning' },
    { id: 'codellama', name: 'CodeLlama', contextWindow: 16000, supportsTools: false, supportsStreaming: true, description: '🏠 Local · Code-specialized model' },
  ],
};

export async function modelsStatus(): Promise<void> {
  const config = getConfigManager();
  const aiConfig = config.getAll().ai;
  const providers = aiConfig.providers;

  // Count available providers
  const activeProviders = Object.entries(providers)
    .filter(([_, p]: [string, unknown]) => (p as Record<string, unknown>).enabled)
    .map(([name, _]) => name);

  fishBox('🧠 Model Status', [
    chalk.hex('#818cf8')(`Active Providers: `) + chalk.hex('#34d399')(`${activeProviders.length} configured`),
    activeProviders.length > 0 ? chalk.dim(`  └─ ${activeProviders.join(', ')}`) : '',
    chalk.hex('#818cf8')(`Default Provider: `) + chalk.hex('#34d399')(aiConfig.defaultProvider),
    chalk.hex('#818cf8')(`Default Model:    `) + chalk.hex('#34d399')(
      ((providers as Record<string, unknown>)[aiConfig.defaultProvider as string] as Record<string, unknown>)?.defaultModel || 'auto'
    ),
    chalk.hex('#818cf8')(`Fallback Chain:   `) + chalk.dim(aiConfig.fallbackChain.join(' → ')),
    chalk.hex('#818cf8')(`Temperature:      `) + chalk.dim(String(aiConfig.temperature)),
    chalk.hex('#818cf8')(`Max Tokens:       `) + chalk.dim(String(aiConfig.maxTokens)),
  ]);

  // Show free provider recommendations
  console.log('');
  console.log(FIRE('  🔥 ZERO-SETUP FREE MODELS:'));
  console.log(chalk.hex('#fbbf24')('  • Pollinations — No API key required, works out of the box'));
  console.log(chalk.hex('#fbbf24')('  • OpenRouter — Free tier with many models (need API key)'));
  console.log(chalk.hex('#fbbf24')('  • Groq — Fast free tier with rate limits (need API key)'));
  console.log(chalk.hex('#fbbf24')('  • Ollama — Run models locally (no internet needed)'));
  console.log('');
}

export async function modelsList(): Promise<void> {
  const spinner = new FishThinkingAnimation('Discovering free models');
  spinner.start();

  try {
    resetRouter();
    const router = getRouter();

    // Get models from API where possible
    let apiModels = await router.listAllModels();
    spinner.stop('Models discovered');

    // Merge with our free model registry
    const allModels = [...apiModels];

    // Add registry models for enabled providers
    const config = getConfigManager();
    const providers = config.getAll().ai.providers;

    for (const [providerName, models] of Object.entries(FREE_MODEL_REGISTRY)) {
      const providerConfig = (providers as Record<string, unknown>)[providerName] as Record<string, unknown>;
      if (providerConfig?.enabled !== false) {
        for (const model of models) {
          // Only add if not already present
          if (!allModels.some(m => m.id === model.id && m.provider === providerName)) {
            allModels.push({ ...model, provider: providerName });
          }
        }
      }
    }

    // Filter: Only show FREE models or LOCAL models
    const freeModels = allModels.filter((m: any) =>
      m.description?.includes('🆓') ||
      m.description?.includes('FREE') ||
      m.description?.includes('🏠') ||
      m.provider === 'ollama' ||
      m.provider === 'pollinations'
    );

    if (freeModels.length === 0) {
      fishInfo('No free models currently available. Enable pollinations (no key needed) or add API keys.');
      return;
    }

    // Group by provider
    const byProvider = new Map<string, typeof freeModels>();
    for (const model of freeModels) {
      if (!byProvider.has(model.provider)) byProvider.set(model.provider, []);
      byProvider.get(model.provider)!.push(model);
    }

    // Provider display names
    const providerNames: Record<string, string> = {
      pollinations: '🔥 POLLINATIONS (No API Key)',
      openrouter: '🔌 OPENROUTER (Free Tier)',
      groq: '⚡ GROQ (Fast Free)',
      ollama: '🏠 OLLAMA (Local)',
      opencode: '🔷 OPENCODE',
    };

    console.log('');
    console.log(chalk.bold.hex('#f59e0b')('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold.hex('#f59e0b')('  🆓 FREE & LOCAL AI MODELS FOR AZERCLAW'));
    console.log(chalk.bold.hex('#f59e0b')('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log('');

    for (const [provider, provModels] of byProvider) {
      const displayName = providerNames[provider] || provider.toUpperCase();
      console.log(LUXE(`  ─── ${displayName} ───`));

      for (const model of provModels) {
        const tools = model.supportsTools ? chalk.hex('#34d399')('🔧') : chalk.dim('○');
        const stream = model.supportsStreaming ? chalk.hex('#60a5fa')('⚡') : chalk.dim('○');
        const ctx = chalk.dim(`${(model.contextWindow / 1000).toFixed(0)}K`);
        const isFree = model.description?.includes('🆓') || model.description?.includes('FREE');
        const isLocal = model.description?.includes('🏠') || provider === 'ollama';

        let modelId = chalk.hex('#e2e8f0')(model.id.padEnd(35));
        if (isFree) modelId = chalk.hex('#fbbf24')(model.id.padEnd(35)); // Gold for free
        if (isLocal) modelId = chalk.hex('#34d399')(model.id.padEnd(35)); // Green for local

        console.log(`  ${tools} ${stream} ${modelId} ${ctx}`);
        if (model.description) {
          console.log(chalk.dim(`      └─ ${model.description}`));
        }
      }
      console.log('');
    }

    console.log(chalk.hex('#818cf8')('  🔧 = Tool Use  ⚡ = Streaming  ○ = Not Available'));
    console.log('');
    console.log(chalk.hex('#fbbf24')('  💡 Pro tip: Pollinations works without any API key setup!'));
    console.log(chalk.dim('  Set AZERTRON_OPENROUTER_KEY or AZERTRON_GROQ_KEY for more options.'));
    console.log('');
  } catch (error: any) {
    spinner.fail('Failed to fetch models');
    console.error(chalk.red(`  Error: ${error.message}`));
  }
}
