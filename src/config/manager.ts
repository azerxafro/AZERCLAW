/**
 * 🐟 AZERCLAW Configuration Manager
 * 
 * Layered configuration system (Claude Code / Azerclaw style):
 *   1. CLI flags (--model, --provider) — runtime overrides
 *   2. Environment variables (OPENAI_API_KEY, etc.)
 *   3. Local project settings (.azerclaw/settings.local.json — gitignored)
 *   4. Project settings (.azerclaw/settings.json — committed to git)
 *   5. User settings (~/.azerclaw/settings.json — personal defaults)
 * 
 * Stored at ~/.azerclaw/settings.json with 0600 permissions.
 * All layers merge into a single resolved config at runtime.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { ConfigSchema, AzerclawConfig, ProviderName, ProjectSettingsSchema, ProjectSettings, ProviderConfig } from './schema';

const CONFIG_DIR = path.join(os.homedir(), '.azerclaw');
const CONFIG_FILE = path.join(CONFIG_DIR, 'settings.json');
const LEGACY_CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const SKILLS_DIR = path.join(CONFIG_DIR, 'skills');
const MEMORY_DIR = path.join(CONFIG_DIR, 'memory');
const LOGS_DIR = path.join(CONFIG_DIR, 'logs');

const PROJECT_DIR_NAME = '.azerclaw';
const PROJECT_SETTINGS_FILE = 'settings.json';
const PROJECT_LOCAL_SETTINGS_FILE = 'settings.local.json';
const PROJECT_INSTRUCTIONS_FILE = 'AZERCLAW.md';

// ─── Ensure directories exist ───────────────────────────────────

function ensureDirs(): void {
  for (const dir of [CONFIG_DIR, SKILLS_DIR, MEMORY_DIR, LOGS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
  }
}

// ─── Config Manager ─────────────────────────────────────────────

class ConfigManager extends EventEmitter {
  private config: AzerclawConfig;
  private configPath: string;
  private projectSettings: ProjectSettings | null = null;
  private localProjectSettings: ProjectSettings | null = null;
  private runtimeOverrides: Record<string, unknown> = {};
  private watcher: fs.FSWatcher | null = null;
  private isSaving = false;
  private reloadTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.configPath = CONFIG_FILE;
    ensureDirs();
    this.migrateLegacyConfig();
    this.config = this.load();
    this.loadProjectSettings();
  }

  // ─── Legacy Migration ───────────────────────────────────────

  /**
   * Migrate from old config.json to new settings.json if needed.
   */
  private migrateLegacyConfig(): void {
    if (fs.existsSync(LEGACY_CONFIG_FILE) && !fs.existsSync(CONFIG_FILE)) {
      try {
        const raw = fs.readFileSync(LEGACY_CONFIG_FILE, 'utf-8');
        fs.writeFileSync(CONFIG_FILE, raw, { mode: 0o600 });
      } catch (e) {
        if (process.env.AZERCLAW_DEBUG) {
          console.error('[ConfigManager] Legacy migration failed:', e instanceof Error ? e.message : String(e));
        }
      }
    }
  }

  // ─── Core Config I/O ───────────────────────────────────────

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
    if (process.env.AZERCLAW_DEBUG) {
      console.log(`[Config] Parsed Defaults opencode enabled: ${defaults.ai.providers.opencode.enabled}`);
      console.log(`[Config] Parsed Defaults opencode key: ${defaults.ai.providers.opencode.apiKey.slice(0, 10)}...`);
    }
    this.save(defaults);
    return defaults;
  }

  /**
   * Reload config from disk (useful after external changes).
   */
  reload(): void {
    this.config = this.load();
    this.loadProjectSettings();
    this.emit('change');
  }

  /**
   * Start watching the config file for external changes to synchronize apps/CLI.
   */
  watch(): void {
    if (this.watcher) return;
    try {
      if (fs.existsSync(this.configPath)) {
        this.watcher = fs.watch(this.configPath, (eventType) => {
          if (eventType !== 'change') return;
          // Ignore self-writes to break reload loops.
          if (this.isSaving) return;
          // Coalesce rapid events into a single reload.
          if (this.reloadTimer) clearTimeout(this.reloadTimer);
          this.reloadTimer = setTimeout(() => {
            this.reloadTimer = null;
            this.reload();
          }, 100);
        });
      }
    } catch (e) {
      if (process.env.AZERCLAW_DEBUG) {
        console.error('[ConfigManager] Watcher setup failed:', e instanceof Error ? e.message : String(e));
      }
    }
  }

  /**
   * Stop watching the config file.
   */
  unwatch(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  /**
   * Save config to disk with secure permissions.
   */
  private save(config?: AzerclawConfig): void {
    const data = config || this.config;
    this.isSaving = true;
    try {
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(data, null, 2),
        { mode: 0o600 }
      );
    } finally {
      // Clear after the next tick so the fs.watch callback (which fires async
      // after the write completes) still sees isSaving=true.
      setTimeout(() => { this.isSaving = false; }, 150);
    }
  }

  // ─── Project Settings (Layered) ────────────────────────────

  /**
   * Load project-level .azerclaw/settings.json and settings.local.json.
   */
  private loadProjectSettings(): void {
    const cwd = process.cwd();
    const projectDir = path.join(cwd, PROJECT_DIR_NAME);

    // Project settings (shared, committed)
    const projectFile = path.join(projectDir, PROJECT_SETTINGS_FILE);
    if (fs.existsSync(projectFile)) {
      try {
        const raw = fs.readFileSync(projectFile, 'utf-8');
        this.projectSettings = ProjectSettingsSchema.parse(JSON.parse(raw));
      } catch (e) {
        if (process.env.AZERCLAW_DEBUG) {
          console.error('[ConfigManager] Project settings load failed:', e instanceof Error ? e.message : String(e));
        }
        this.projectSettings = null;
      }
    }

    // Local project settings (personal, gitignored)
    const localFile = path.join(projectDir, PROJECT_LOCAL_SETTINGS_FILE);
    if (fs.existsSync(localFile)) {
      try {
        const raw = fs.readFileSync(localFile, 'utf-8');
        this.localProjectSettings = ProjectSettingsSchema.parse(JSON.parse(raw));
      } catch (e) {
        if (process.env.AZERCLAW_DEBUG) {
          console.error('[ConfigManager] Local project settings load failed:', e instanceof Error ? e.message : String(e));
        }
        this.localProjectSettings = null;
      }
    }
  }

  /**
   * Get the project instructions file content (AZERCLAW.md).
   */
  getProjectInstructions(): string | null {
    const cwd = process.cwd();
    const instrFile = path.join(cwd, PROJECT_INSTRUCTIONS_FILE);
    if (fs.existsSync(instrFile)) {
      try { return fs.readFileSync(instrFile, 'utf-8'); } catch { return null; }
    }
    // Also check .azerclaw/AZERCLAW.md
    const altFile = path.join(cwd, PROJECT_DIR_NAME, PROJECT_INSTRUCTIONS_FILE);
    if (fs.existsSync(altFile)) {
      try { return fs.readFileSync(altFile, 'utf-8'); } catch { return null; }
    }
    return null;
  }

  /**
   * Initialize project settings directory.
   */
  initProject(instructions: string = ''): void {
    const cwd = process.cwd();
    const projectDir = path.join(cwd, PROJECT_DIR_NAME);
    
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    // Create settings.json
    const settingsFile = path.join(projectDir, PROJECT_SETTINGS_FILE);
    if (!fs.existsSync(settingsFile)) {
      fs.writeFileSync(settingsFile, JSON.stringify({
        instructions: [],
        customInstructions: '',
        allowedTools: [],
        deniedTools: [],
        autoApprove: [],
      }, null, 2));
    }

    // Create .gitignore for local settings
    const gitignoreFile = path.join(projectDir, '.gitignore');
    if (!fs.existsSync(gitignoreFile)) {
      fs.writeFileSync(gitignoreFile, 'settings.local.json\n');
    }

    // Create AZERCLAW.md
    const instrFile = path.join(cwd, PROJECT_INSTRUCTIONS_FILE);
    if (!fs.existsSync(instrFile)) {
      const defaultInstructions = instructions || [
        `# AZERCLAW.md`,
        ``,
        `## Project Context`,
        `<!-- Describe your project here so AZERCLAW understands it -->`,
        ``,
        `## Coding Standards`,
        `<!-- Add your team's coding conventions -->`,
        ``,
        `## Common Commands`,
        `<!-- List frequently used commands -->`,
        `\`\`\`bash`,
        `# npm run dev`,
        `# npm test`,
        `\`\`\``,
        ``,
        `## Important Notes`,
        `<!-- Add any critical information for the AI agent -->`,
        ``,
      ].join('\n');
      fs.writeFileSync(instrFile, defaultInstructions);
    }

    this.set('hasCompletedProjectOnboarding', true);
  }

  /**
   * Get merged project settings (local overrides project).
   */
  getProjectSettings(): ProjectSettings | null {
    if (!this.projectSettings && !this.localProjectSettings) return null;
    return { ...this.projectSettings, ...this.localProjectSettings } as ProjectSettings;
  }

  /**
   * Check if current directory has project settings.
   */
  hasProjectSettings(): boolean {
    const cwd = process.cwd();
    return fs.existsSync(path.join(cwd, PROJECT_DIR_NAME, PROJECT_SETTINGS_FILE)) ||
           fs.existsSync(path.join(cwd, PROJECT_INSTRUCTIONS_FILE));
  }

  // ─── Runtime Overrides (CLI flags) ─────────────────────────

  /**
   * Set a runtime override (from CLI flags like --model, --provider).
   * These take highest priority and don't persist.
   */
  setRuntimeOverride(key: string, value: unknown): void {
    this.runtimeOverrides[key] = value;
  }

  /**
   * Apply CLI flag overrides to the active session.
   */
  applyRuntimeOverrides(opts: { model?: string; provider?: string }): void {
    if (opts.provider) {
      this.runtimeOverrides['ai.defaultProvider'] = opts.provider;
      this.runtimeOverrides[`ai.providers.${opts.provider}.enabled`] = true;
    }
    if (opts.model) {
      const provider = (opts.provider || this.config.ai.defaultProvider) as ProviderName;
      this.runtimeOverrides[`ai.providers.${provider}.defaultModel`] = opts.model;
    }
  }

  // ─── Config Getters ────────────────────────────────────────

  /**
   * Get the full config object (with runtime overrides applied).
   */
  getAll(): AzerclawConfig {
    const base = JSON.parse(JSON.stringify(this.config)) as AzerclawConfig;
    // Apply runtime overrides
    for (const [keyPath, value] of Object.entries(this.runtimeOverrides)) {
      const keys = keyPath.split('.');
      let current: any = base;
      for (let i = 0; i < keys.length - 1; i++) {
        if (current[keys[i]] === undefined) current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
    }
    return base;
  }

  /**
   * Get a nested config value by dot-path (e.g., "ai.providers.openai.apiKey").
   * Respects runtime overrides.
   */
  get(keyPath: string): unknown {
    // Check runtime overrides first
    if (keyPath in this.runtimeOverrides) return this.runtimeOverrides[keyPath];

    const keys = keyPath.split('.');
    let current: any = this.config;
    
    for (const key of keys) {
      if (current === undefined || current === null) return undefined;
      current = current[key];
    }
    
    return current;
  }

  /**
   * Set a nested config value by dot-path (persists to disk).
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

  // ─── Onboarding State ──────────────────────────────────────

  /**
   * Check if this is the first run.
   */
  isFirstRun(): boolean {
    return this.config.firstRun;
  }

  /**
   * Check if onboarding has been completed.
   */
  hasCompletedOnboarding(): boolean {
    return this.config.hasCompletedOnboarding;
  }

  /**
   * Mark first run as complete.
   */
  completeFirstRun(): void {
    this.set('firstRun', false);
    this.set('hasCompletedOnboarding', true);
  }

  /**
   * Skip onboarding (e.g., when env keys are auto-detected).
   */
  skipOnboarding(): void {
    this.set('firstRun', false);
    this.set('hasCompletedOnboarding', true);
  }

  // ─── Provider Management ───────────────────────────────────

  /**
   * Get the active provider configuration (respects runtime overrides).
   */
  getActiveProvider(): { name: ProviderName; config: any } {
    const all = this.getAll();
    const providerName = all.ai.defaultProvider as ProviderName;
    const providerConfig = all.ai.providers[providerName];
    return { name: providerName, config: providerConfig };
  }

  /**
   * Get the fallback provider configuration.
   */
  getFallbackProvider(): { name: ProviderName; config: any } | null {
    const all = this.getAll();
    const chain = all.ai.fallbackChain;
    const activeProvider = all.ai.defaultProvider;

    // Find first enabled fallback that isn't the active provider
    for (const name of chain) {
      if (name === activeProvider) continue;
      const provConfig = all.ai.providers[name as ProviderName];
      if (provConfig && provConfig.enabled) {
        return { name: name as ProviderName, config: provConfig };
      }
    }
    return null;
  }

  /**
   * Get all enabled providers.
   */
  getEnabledProviders(): { name: string; config: ProviderConfig }[] {
    const providers = this.config?.ai?.providers;
    if (!providers || typeof providers !== 'object') return [];
    const enabled: { name: string; config: any }[] = [];

    for (const [name, provConfig] of Object.entries(providers)) {
      if (provConfig && (provConfig as Record<string, unknown>).enabled) {
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
   * Switch the active provider.
   */
  switchProvider(provider: ProviderName): void {
    const providerConfig = this.config.ai.providers[provider];
    if (!providerConfig) throw new Error(`Unknown provider: ${provider}`);
    this.set('ai.defaultProvider', provider);
    if (!providerConfig.enabled) {
      this.set(`ai.providers.${provider}.enabled`, true);
    }
  }

  /**
   * Change the default model for a provider (or the active provider).
   */
  setProviderModel(model: string, provider?: ProviderName): void {
    const target = provider || (this.config.ai.defaultProvider as ProviderName);
    this.set(`ai.providers.${target}.defaultModel`, model);
  }

  /**
   * Update the API key for a provider without changing enabled state.
   */
  updateProviderKey(provider: ProviderName, apiKey: string): void {
    this.set(`ai.providers.${provider}.apiKey`, apiKey);
    if (apiKey) {
      this.set(`ai.providers.${provider}.enabled`, true);
    }
  }

  /**
   * Set the fallback chain order.
   */
  setFallbackChain(chain: string[]): void {
    this.set('ai.fallbackChain', chain);
  }

  /**
   * Auto-detect providers from environment variables.
   * Returns list of providers that were auto-configured.
   */
  resolveEnvOverrides(): string[] {
    const envMap: Record<string, { provider: ProviderName; key: string }> = {
      'AZERTRON_OPENCODE_KEY': { provider: 'opencode', key: 'apiKey' },
      'AZERTRON_OPENROUTER_KEY': { provider: 'openrouter', key: 'apiKey' },
      'AZERTRON_GROQ_KEY': { provider: 'groq', key: 'apiKey' },
    };

    const detected: string[] = [];
    for (const [envVar, { provider, key }] of Object.entries(envMap)) {
      const value = process.env[envVar];
      if (value) {
        this.set(`ai.providers.${provider}.${key}`, value);
        this.set(`ai.providers.${provider}.enabled`, true);
        if (!detected.includes(provider)) detected.push(provider);
      }
    }

    // If we detected providers and there's no active default, set one
    if (detected.length > 0) {
      const currentDefault = this.config.ai.defaultProvider as ProviderName;
      const currentDefaultEnabled = this.config.ai.providers[currentDefault]?.enabled;
      if (!currentDefaultEnabled) {
        this.set('ai.defaultProvider', detected[0]);
      }
    }

    return detected;
  }

  // ─── Status & Diagnostics ──────────────────────────────────

  /**
   * Get a full status snapshot for /status command.
   */
  getStatus(): {
    version: string;
    provider: string;
    model: string;
    fallback: string | null;
    authRoute: 'api_key' | 'env_var' | 'none';
    enabledProviders: string[];
    projectConfigured: boolean;
    configFile: string;
  } {
    const all = this.getAll();
    const provider = all.ai.defaultProvider as ProviderName;
    const provConfig = all.ai.providers[provider];
    const model = provConfig?.defaultModel || 'auto';
    const fallback = this.getFallbackProvider();
    
    // Determine auth route
    let authRoute: 'api_key' | 'env_var' | 'none' = 'none';
    if ((provConfig as Record<string, unknown>)?.apiKey) {
      // Check if the key came from env
      const envKeys = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY', 'GROQ_API_KEY'];
      const hasEnvKey = envKeys.some(k => process.env[k]);
      authRoute = hasEnvKey ? 'env_var' : 'api_key';
    }

    return {
      version: all.version,
      provider,
      model,
      fallback: fallback ? `${fallback.name} (${fallback.config.defaultModel})` : null,
      authRoute,
      enabledProviders: this.getEnabledProviders().map(p => p.name),
      projectConfigured: this.hasProjectSettings(),
      configFile: this.configPath,
    };
  }

  // ─── Paths ─────────────────────────────────────────────────

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
      projectDir: path.join(process.cwd(), PROJECT_DIR_NAME),
      projectSettings: path.join(process.cwd(), PROJECT_DIR_NAME, PROJECT_SETTINGS_FILE),
      projectLocalSettings: path.join(process.cwd(), PROJECT_DIR_NAME, PROJECT_LOCAL_SETTINGS_FILE),
      projectInstructions: path.join(process.cwd(), PROJECT_INSTRUCTIONS_FILE),
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

export function resetConfigManager(): void {
  instance = null;
}

export { ConfigManager, CONFIG_DIR, CONFIG_FILE };
