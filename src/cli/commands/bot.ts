/**
 * 🐟 AZERCLAW Bot Command
 * Manages messenger bots (Telegram, Discord, Slack).
 */

const { Gateway } = require('../../core/gateway');
const { playSplashScreen, printQuickSplash, fishSuccess, fishError, fishInfo } = require('../animations/fish');
const { getConfigManager } = require('../../config/manager');
const { version: VERSION } = require('../../../../package.json');

export async function startBot(options: { port?: number }): Promise<void> {
  const config = getConfigManager().getAll();
  const enabledPlatforms = Object.entries(config.channels || {})
    .filter(([platform, cfg]) => platform !== 'routing' && (cfg as Record<string, unknown>).enabled)
    .map(([platform]) => platform);

  if (enabledPlatforms.length === 0) {
    fishError('No bot channels enabled. Use "azerclaw config channels list" to check.');
    fishInfo('Enable a channel with: azerclaw config set channels.telegram.enabled true');
    fishInfo('Set token with: azerclaw config set channels.telegram.token YOUR_TOKEN');
    return;
  }

  printQuickSplash(VERSION);
  fishInfo(`Starting bots: ${enabledPlatforms.join(', ')}...`);

  const port = options.port || 3142;
  const gateway = new Gateway(port);

  try {
    await gateway.start();
    fishSuccess(`Gateway active on port ${port}`);
    fishInfo('Bots are running. Press Ctrl+C to stop.');
    
    // Keep alive
    process.on('SIGINT', async () => {
      fishInfo('\nStopping bots...');
      await gateway.stop();
      process.exit(0);
    });
  } catch (error: any) {
    fishError(`Failed to start gateway: ${error.message}`);
    process.exit(1);
  }
}
