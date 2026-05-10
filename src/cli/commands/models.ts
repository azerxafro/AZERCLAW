/**
 * 🐟 AZERCLAW Models Command
 * List and manage AI models across all providers.
 */

const chalk = require('chalk');
const gradientString = require('gradient-string');
const { getRouter, resetRouter } = require('../../providers/router');
const { getConfigManager } = require('../../config/manager');
const { fishSuccess, fishInfo, fishBox, FishThinkingAnimation } = require('../animations/fish');

const LUXE = gradientString(['#c084fc', '#818cf8', '#60a5fa', '#34d399']);

export async function modelsStatus(): Promise<void> {
  const config = getConfigManager();
  const aiConfig = config.getAll().ai;
  
  fishBox('🧠 Model Status', [
    chalk.hex('#818cf8')(`Default Provider: `) + chalk.hex('#34d399')(aiConfig.defaultProvider),
    chalk.hex('#818cf8')(`Default Model:    `) + chalk.hex('#34d399')(
      (aiConfig.providers as any)[aiConfig.defaultProvider]?.defaultModel || 'auto'
    ),
    chalk.hex('#818cf8')(`Fallback Chain:   `) + chalk.dim(aiConfig.fallbackChain.join(' → ')),
    chalk.hex('#818cf8')(`Temperature:      `) + chalk.dim(String(aiConfig.temperature)),
    chalk.hex('#818cf8')(`Max Tokens:       `) + chalk.dim(String(aiConfig.maxTokens)),
  ]);
}

export async function modelsList(): Promise<void> {
  const spinner = new FishThinkingAnimation('Fetching models');
  spinner.start();

  try {
    resetRouter();
    const router = getRouter();
    const models = await router.listAllModels();
    spinner.stop('Models loaded');

    if (models.length === 0) {
      fishInfo('No models available. Configure providers with: azerclaw onboard');
      return;
    }

    // Group by provider
    const byProvider = new Map<string, typeof models>();
    for (const model of models) {
      if (!byProvider.has(model.provider)) byProvider.set(model.provider, []);
      byProvider.get(model.provider)!.push(model);
    }

    console.log('');
    for (const [provider, provModels] of byProvider) {
      console.log(LUXE(`  ─── ${provider.toUpperCase()} ───`));
      for (const model of provModels) {
        const tools = model.supportsTools ? chalk.hex('#34d399')('🔧') : '  ';
        const stream = model.supportsStreaming ? chalk.hex('#60a5fa')('⚡') : '  ';
        const ctx = chalk.dim(`${(model.contextWindow / 1000).toFixed(0)}K ctx`);
        const status = (model as any).status === 'online' ? chalk.green('●') : ' ';
        const isFree = (model as any).description?.includes('FREE');
        const modelId = isFree ? chalk.yellow(model.id) : chalk.hex('#e2e8f0')(model.id);
        
        console.log(`  ${status} ${tools} ${stream} ${modelId.padEnd(50)} ${ctx}`);
        if (isFree) {
          console.log(chalk.dim(`      └─ ${(model as any).description}`));
        }
      }
      console.log('');
    }

    console.log(chalk.dim('  ● = Online  🔧 = Tool Use  ⚡ = Streaming'));
    console.log('');
  } catch (error: any) {
    spinner.fail('Failed to fetch models');
  }
}

module.exports = { modelsStatus, modelsList };
