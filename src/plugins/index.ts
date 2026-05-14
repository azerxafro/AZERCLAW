/**
 * 🐟 AZERCLAW Plugin System
 * Main entry point for the plugin architecture
 */

export * from './types';
export * from './manager';
export * from './loader';
export * from './registry';

// ─── Plugin System Initialization ───────────────────────────────────────

import { PluginManager } from './manager';
import { PluginRegistry } from './registry';
import { autoLoadPlugins } from './loader';
import { getToolRegistry } from '../tools/registry';

let pluginManager: PluginManager | null = null;
let pluginRegistry: PluginRegistry | null = null;

export function getPluginManager(): PluginManager {
  if (!pluginManager) {
    const toolRegistry = getToolRegistry();
    pluginManager = new PluginManager();
    pluginRegistry = new PluginRegistry(toolRegistry);
    
    // Set up event handlers
    pluginManager.on('plugin-loaded', (loadedPlugin) => {
      if (pluginRegistry) {
        pluginRegistry.registerPlugin(loadedPlugin);
      }
    });
    
    pluginManager.on('plugin-unloaded', ({ pluginId }) => {
      if (pluginRegistry) {
        pluginRegistry.unregisterPlugin(pluginId);
      }
    });
    
    pluginManager.on('tool-register', ({ pluginId, tool }) => {
      if (pluginRegistry) {
        pluginRegistry.registerTool(pluginId, tool);
      }
    });
    
    pluginManager.on('tool-unregister', ({ pluginId, toolName }) => {
      if (pluginRegistry) {
        pluginRegistry.unregisterTool(pluginId, toolName);
      }
    });
  }
  
  return pluginManager;
}

export function getPluginRegistry(): PluginRegistry {
  if (!pluginRegistry) {
    getPluginManager(); // Initialize both
  }
  
  return pluginRegistry!;
}

export async function initializePlugins(workspaceDir?: string): Promise<void> {
  const manager = getPluginManager();
  
  try {
    // Auto-load plugins
    await autoLoadPlugins(manager, workspaceDir);
    
    console.log(`[PluginSystem] Initialized with ${manager.getPluginCount()} plugins`);
  } catch (error) {
    console.error('[PluginSystem] Failed to initialize plugins:', error);
    throw error;
  }
}

export async function shutdownPlugins(): Promise<void> {
  if (pluginManager) {
    const plugins = await pluginManager.listPlugins();
    
    // Deactivate all active plugins
    for (const plugin of plugins) {
      if (plugin.status === 'active') {
        try {
          await pluginManager.deactivatePlugin(plugin.id);
        } catch (error) {
          console.error(`Error deactivating plugin ${plugin.id}:`, error);
        }
      }
    }
    
    // Unload all plugins
    for (const plugin of plugins) {
      try {
        await pluginManager.unloadPlugin(plugin.id);
      } catch (error) {
        console.error(`Error unloading plugin ${plugin.id}:`, error);
      }
    }
    
    if (pluginRegistry) {
      pluginRegistry.cleanup();
    }
    
    pluginManager.removeAllListeners();
    pluginManager = null;
    pluginRegistry = null;
  }
}
