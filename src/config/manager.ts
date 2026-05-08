/**
 * 🐟 AZERCLAW Configuration Manager
 * Handles reading, writing, and validating the config file.
 * Stored at ~/.azerclaw/config.json with 0600 permissions.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigSchema, AzerclawConfig, ProviderName } from './schema';

const CONFIG_DIR = path.join(os.homedir(), '.azerclaw');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const SKILLS_DIR = path.join(CONFIG_DIR, 'skills');
const MEMORY_DIR = path.join(CONFIG_DIR, 'memory');
const LOGS_DIR = path.join(CONFIG_DIR, 'logs');

// ─── Ensure directories exist ───────────────────────────────────

function ensureDirs(): void {
  for (const dir of [CONFIG_DIR, SKILLS_DIR, MEMORY_DIR, LOGS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
  }
}

// ─── Config Manager ─────────────────────────────────────────────

class ConfigManager {
  private config: AzerclawConfig;
  private configPath: string;

  constructor() {
    this.configPath = CONFIG_FILE;
    ensureDirs();
    this.config = this.load();
  }

  /**
   * Load config from disk, creating defaults if not found.
   */
  private load(): AzerclawConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(raw);
        return ConfigSchema.parse(parsed);
      }
    } catch (e) {
      // Invalid config, fall through to defaults
    }
    
    const defaults = ConfigSchema.parse({});
    this.save(defaults);
    return defaults;
  }

  /**
   * Save config to disk with secure permissions.
   */
  private save(config?: AzerclawConfig): void {
    const data = config || this.config;
    fs.writeFileSync(
      this.configPath,
      JSON.stringify(data, null, 2),
      { mode: 0o600 }
    );
  }

  /**
   * Get the full config object.
   */
  getAll(): AzerclawConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * Get a nested config value by dot-path (e.g., "ai.providers.openai.apiKey").
   */
  get(keyPath: string): unknown {
    const keys = keyPath.split('.');
    let current: any = this.config;
    
    for (const key of keys) {
      if (current === undefined || current === null) return undefined;
      current = current[key];
    }
    
    return current;
  }

  /**
   * Set a nested config value by dot-path.
   */
  set(keyPath: string, value: unknown): void {
    const keys = keyPath.split('.');
    let current: any = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (current[keys[i]] === undefined) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    
    // Re-validate
    this.config = ConfigSchema.parse(this.config);
    this.save();
  }

  /**
   * Check if this is the first run.
   */
  isFirstRun(): boolean {
    return this.config.firstRun;
  }

  /**
   * Mark first run as complete.
   */
  completeFirstRun(): void {
    this.set('firstRun', false);
  }

  /**
   * Get the active provider configuration.
   */
  getActiveProvider(): { name: ProviderName; config: any } {
    const providerName = this.config.ai.defaultProvider as ProviderName;
    const providerConfig = this.config.ai.providers[providerName];
    return { name: providerName, config: providerConfig };
  }

  /**
   * Get all enabled providers.
   */
  getEnabledProviders(): { name: string; config: any }[] {
    const providers = this.config?.ai?.providers;
    if (!providers || typeof providers !== 'object') return [];
    const enabled: { name: string; config: any }[] = [];
    
    for (const [name, provConfig] of Object.entries(providers)) {
      if (provConfig && (provConfig as any).enabled) {
        enabled.push({ name, config: provConfig });
      }
    }
    
    return enabled;
  }

  /**
   * Set API key for a provider and enable it.
   */
  setProviderKey(provider: ProviderName, apiKey: string): void {
    this.set(`ai.providers.${provider}.apiKey`, apiKey);
    this.set(`ai.providers.${provider}.enabled`, true);
    
    // If no default provider set, use this one
    if (!this.getEnabledProviders().some(p => p.name === this.config.ai.defaultProvider)) {
      this.set('ai.defaultProvider', provider);
    }
  }

  /**
   * Resolve provider from environment variables.
   */
  resolveEnvOverrides(): void {
    const envMap: Record<string, { provider: ProviderName; key: string }> = {
      'AZERCLAW_OPENAI_KEY': { provider: 'openai', key: 'apiKey' },
      'OPENAI_API_KEY': { provider: 'openai', key: 'apiKey' },
      'AZERCLAW_ANTHROPIC_KEY': { provider: 'anthropic', key: 'apiKey' },
      'ANTHROPIC_API_KEY': { provider: 'anthropic', key: 'apiKey' },
      'AZERCLAW_GOOGLE_KEY': { provider: 'google', key: 'apiKey' },
      'GOOGLE_API_KEY': { provider: 'google', key: 'apiKey' },
      'AZERCLAW_GROQ_KEY': { provider: 'groq', key: 'apiKey' },
      'GROQ_API_KEY': { provider: 'groq', key: 'apiKey' },
      'AZERCLAW_DEEPSEEK_KEY': { provider: 'deepseek', key: 'apiKey' },
      'AZERCLAW_OPENROUTER_KEY': { provider: 'openrouter', key: 'apiKey' },
      'OPENROUTER_API_KEY': { provider: 'openrouter', key: 'apiKey' },
    };

    for (const [envVar, { provider, key }] of Object.entries(envMap)) {
      const value = process.env[envVar];
      if (value) {
        this.set(`ai.providers.${provider}.${key}`, value);
        this.set(`ai.providers.${provider}.enabled`, true);
      }
    }
  }

  /**
   * Get config directory paths.
   */
  get paths() {
    return {
      configDir: CONFIG_DIR,
      configFile: CONFIG_FILE,
      skillsDir: SKILLS_DIR,
      memoryDir: MEMORY_DIR,
      logsDir: LOGS_DIR,
    };
  }

  /**
   * Reset config to defaults.
   */
  reset(): void {
    this.config = ConfigSchema.parse({});
    this.save();
  }
}

// ─── Singleton Instance ─────────────────────────────────────────

let instance: ConfigManager | null = null;

export function getConfigManager(): ConfigManager {
  if (!instance) {
    instance = new ConfigManager();
  }
  return instance;
}

export { ConfigManager, CONFIG_DIR, CONFIG_FILE };
