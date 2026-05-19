/**
 * 🐟 AZERCLAW Plugin Loader
 * Handles plugin discovery, validation, and loading
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Plugin, PluginMetadata, LoadedPlugin } from './types';
import { PluginManager } from './manager';

// ─── Plugin Discovery Paths ─────────────────────────────────────────────

export function getPluginPaths(workspaceDir?: string): string[] {
  const paths: string[] = [];
  
  // Global plugins directory
  const globalPluginDir = path.join(os.homedir(), '.azerclaw', 'plugins');
  if (fs.existsSync(globalPluginDir)) {
    paths.push(globalPluginDir);
  }
  
  // Workspace plugins
  if (workspaceDir) {
    const workspacePluginDir = path.join(workspaceDir, '.azerclaw', 'plugins');
    if (fs.existsSync(workspacePluginDir)) {
      paths.push(workspacePluginDir);
    }
  }
  
  // Bundled plugins (built-in)
  const bundledPluginDir = path.join(__dirname, '..', '..', 'plugins');
  if (fs.existsSync(bundledPluginDir)) {
    paths.push(bundledPluginDir);
  }
  
  return paths;
}

// ─── Plugin Validation ─────────────────────────────────────────────────

export function validatePluginMetadata(metadata: PluginMetadata): string[] {
  const errors: string[] = [];
  
  // Required fields
  if (!metadata.name || typeof metadata.name !== 'string') {
    errors.push('Plugin name is required and must be a string');
  }
  
  if (!metadata.version || typeof metadata.version !== 'string') {
    errors.push('Plugin version is required and must be a string');
  }
  
  if (!metadata.description || typeof metadata.description !== 'string') {
    errors.push('Plugin description is required and must be a string');
  }
  
  if (!Array.isArray(metadata.capabilities)) {
    errors.push('Plugin capabilities must be an array');
  } else {
    metadata.capabilities.forEach((cap, index) => {
      if (!cap.type || typeof cap.type !== 'string') {
        errors.push(`Capability ${index} must have a type`);
      }
      if (!cap.name || typeof cap.name !== 'string') {
        errors.push(`Capability ${index} must have a name`);
      }
    });
  }
  
  if (!Array.isArray(metadata.requires)) {
    errors.push('Plugin requirements must be an array');
  }
  
  if (!Array.isArray(metadata.permissions)) {
    errors.push('Plugin permissions must be an array');
  }
  
  // Version compatibility
  if (metadata.azerclawVersion) {
    // Could implement semver compatibility check here
    // For now, just validate it's a string
    if (typeof metadata.azerclawVersion !== 'string') {
      errors.push('AZERCLAW version must be a string');
    }
  }
  
  return errors;
}

export function validatePluginStructure(pluginPath: string): string[] {
  const errors: string[] = [];
  
  // Check if path exists
  if (!fs.existsSync(pluginPath)) {
    errors.push(`Plugin path does not exist: ${pluginPath}`);
    return errors;
  }
  
  const stat = fs.statSync(pluginPath);
  
  if (stat.isDirectory()) {
    // Directory plugin - check for required files
    const packageJsonPath = path.join(pluginPath, 'package.json');
    const indexPath = path.join(pluginPath, 'index.js');
    const tsIndexPath = path.join(pluginPath, 'index.ts');
    
    if (!fs.existsSync(packageJsonPath)) {
      errors.push('Directory plugin must have package.json');
    }
    
    if (!fs.existsSync(indexPath) && !fs.existsSync(tsIndexPath)) {
      errors.push('Directory plugin must have index.js or index.ts');
    }
    
    // Validate package.json if it exists
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        if (!packageJson.name) {
          errors.push('package.json must have a name field');
        }
        if (!packageJson.version) {
          errors.push('package.json must have a version field');
        }
      } catch (error) {
        errors.push('package.json is not valid JSON');
      }
    }
  } else if (pluginPath.endsWith('.js') || pluginPath.endsWith('.ts')) {
    // Single file plugin - just check if it's readable
    try {
      fs.accessSync(pluginPath, fs.constants.R_OK);
    } catch (error) {
      errors.push(`Plugin file is not readable: ${pluginPath}`);
    }
  } else {
    errors.push('Plugin must be a directory or .js/.ts file');
  }
  
  return errors;
}

// ─── Plugin Loading ───────────────────────────────────────────────────

export async function loadPluginFromFile(pluginPath: string): Promise<Plugin> {
  const errors = validatePluginStructure(pluginPath);
  if (errors.length > 0) {
    throw new Error(`Plugin validation failed:\n${errors.join('\n')}`);
  }
  
  try {
    // Clear require cache to ensure fresh load
    delete require.cache[require.resolve(pluginPath)];
    
    // Load the plugin
    const pluginModule = require(pluginPath);
    const plugin: Plugin = pluginModule.default || pluginModule;
    
    if (!plugin) {
      throw new Error('Plugin does not export a valid plugin object');
    }
    
    // Validate plugin metadata
    if (!plugin.metadata) {
      throw new Error('Plugin must have metadata property');
    }
    
    const metadataErrors = validatePluginMetadata(plugin.metadata);
    if (metadataErrors.length > 0) {
      throw new Error(`Plugin metadata validation failed:\n${metadataErrors.join('\n')}`);
    }
    
    // Validate plugin structure
    if (typeof plugin !== 'object') {
      throw new Error('Plugin must be an object');
    }
    
    return plugin;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to load plugin: ${error}`);
  }
}

// ─── Plugin Discovery ─────────────────────────────────────────────────

export async function discoverPlugins(workspaceDir?: string): Promise<string[]> {
  const pluginPaths: string[] = [];
  const paths = getPluginPaths(workspaceDir);
  const isTsSupported = require.extensions['.ts'] !== undefined || 
         process.execArgv.some(arg => arg.includes('ts-node') || arg.includes('tsx') || arg.includes('register'));
  
  for (const searchPath of paths) {
    try {
      const entries = fs.readdirSync(searchPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(searchPath, entry.name);
        
        if (entry.isDirectory()) {
          // Check if directory contains a plugin
          const packageJsonPath = path.join(fullPath, 'package.json');
          const indexPath = path.join(fullPath, 'index.js');
          const tsIndexPath = path.join(fullPath, 'index.ts');
          
          if (fs.existsSync(packageJsonPath)) {
            if (fs.existsSync(indexPath)) {
              pluginPaths.push(indexPath);
            } else if (fs.existsSync(tsIndexPath) && isTsSupported) {
              pluginPaths.push(tsIndexPath);
            }
          }
        } else if (entry.name.endsWith('.js')) {
          pluginPaths.push(fullPath);
        } else if (entry.name.endsWith('.ts') && isTsSupported) {
          pluginPaths.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Error searching for plugins in ${searchPath}:`, error);
    }
  }
  
  return pluginPaths;
}

// ─── Plugin Auto-Loading ───────────────────────────────────────────────

export async function autoLoadPlugins(manager: PluginManager, workspaceDir?: string): Promise<LoadedPlugin[]> {
  const pluginPaths = await discoverPlugins(workspaceDir);
  const loadedPlugins: LoadedPlugin[] = [];
  
  for (const pluginPath of pluginPaths) {
    try {
      const loadedPlugin = await manager.loadPlugin(pluginPath);
      
      // Auto-activate if configured
      const pluginConfig = getPluginConfig(loadedPlugin.plugin.metadata.name);
      if (pluginConfig?.autoStart !== false) {
        await manager.activatePlugin(loadedPlugin.id);
      }
      
      loadedPlugins.push(loadedPlugin);
    } catch (error) {
      console.error(`Failed to load plugin ${pluginPath}:`, error);
    }
  }
  
  return loadedPlugins;
}

// ─── Plugin Configuration ─────────────────────────────────────────────

export function getPluginConfig(pluginName: string): any {
  const configPath = path.join(os.homedir(), '.azerclaw', 'plugins.json');
  
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return config.plugins?.[pluginName];
    }
  } catch (error) {
    console.warn(`Error loading plugin config for ${pluginName}:`, error);
  }
  
  return null;
}

export function setPluginConfig(pluginName: string, config: any): void {
  const configPath = path.join(os.homedir(), '.azerclaw', 'plugins.json');
  
  try {
    let globalConfig: any = {};
    
    if (fs.existsSync(configPath)) {
      globalConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    
    if (!globalConfig.plugins) {
      globalConfig.plugins = {};
    }
    
    globalConfig.plugins[pluginName] = config;
    
    fs.writeFileSync(configPath, JSON.stringify(globalConfig, null, 2));
  } catch (error) {
    console.error(`Error saving plugin config for ${pluginName}:`, error);
    throw error;
  }
}

// ─── Plugin Utilities ─────────────────────────────────────────────────

export function getPluginId(pluginPath: string): string {
  const basename = path.basename(pluginPath);
  
  // Remove extension if present
  if (basename.endsWith('.js') || basename.endsWith('.ts')) {
    return basename.slice(0, -3);
  }
  
  return basename;
}

export function isPluginCompatible(plugin: Plugin, azerclawVersion: string): boolean {
  // Simple version compatibility check
  // Could implement semver range checking here
  const requiredVersion = plugin.metadata.azerclawVersion;
  
  if (!requiredVersion) {
    return true; // No version requirement
  }
  
  // For now, just check if major version matches
  const requiredMajor = requiredVersion.split('.')[0];
  const currentMajor = azerclawVersion.split('.')[0];
  
  return requiredMajor === currentMajor;
}

export function getPluginDependencies(plugin: Plugin): string[] {
  return [
    ...(plugin.metadata.depends || []),
    ...(plugin.metadata.peerDepends || [])
  ];
}

export function checkPluginDependencies(plugin: Plugin, loadedPlugins: LoadedPlugin[]): string[] {
  const dependencies = getPluginDependencies(plugin);
  const loadedPluginNames = new Set(loadedPlugins.map(p => p.plugin.metadata.name));
  const missing: string[] = [];
  
  for (const dep of dependencies) {
    if (!loadedPluginNames.has(dep)) {
      missing.push(dep);
    }
  }
  
  return missing;
}
