/**
 * 🐟 AZERCLAW Plugin Registry
 * Integrates plugins with the existing tool registry and manages plugin capabilities
 */

import { EventEmitter } from 'events';
import { Tool, ToolRegistry } from '../tools/registry';
import { LoadedPlugin, Plugin, PluginCapability, PluginRegistry as IPluginRegistry } from './types';

// ─── Plugin Registry Implementation ─────────────────────────────────────

export class PluginRegistry extends EventEmitter implements IPluginRegistry {
  private toolRegistry: ToolRegistry;
  private plugins = new Map<string, LoadedPlugin>();
  private pluginTools = new Map<string, Tool[]>(); // pluginId -> tools
  private toolPlugins = new Map<string, string>(); // toolName -> pluginId
  private capabilities = new Map<string, Set<string>>(); // capability -> pluginIds

  constructor(toolRegistry: ToolRegistry) {
    super();
    this.toolRegistry = toolRegistry;
  }

  // ─── Plugin Management ───────────────────────────────────────────────

  registerPlugin(plugin: LoadedPlugin): void {
    this.plugins.set(plugin.id, plugin);
    
    // Register capabilities
    for (const capability of plugin.plugin.metadata.capabilities) {
      if (!this.capabilities.has(capability.type)) {
        this.capabilities.set(capability.type, new Set());
      }
      this.capabilities.get(capability.type)!.add(plugin.id);
    }
    
    // Register tools
    if (plugin.plugin.tools) {
      this.pluginTools.set(plugin.id, plugin.plugin.tools);
      
      for (const tool of plugin.plugin.tools) {
        this.toolRegistry.registerTool(tool);
        this.toolPlugins.set(tool.name, plugin.id);
      }
    }
    
    this.emit('plugin-registered', plugin);
  }

  unregisterPlugin(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return;
    }

    // Unregister tools
    const tools = this.pluginTools.get(pluginId);
    if (tools) {
      for (const tool of tools) {
        this.toolRegistry.unregisterTool(tool.name);
        this.toolPlugins.delete(tool.name);
      }
      this.pluginTools.delete(pluginId);
    }

    // Unregister capabilities
    for (const capability of plugin.plugin.metadata.capabilities) {
      const capabilitySet = this.capabilities.get(capability.type);
      if (capabilitySet) {
        capabilitySet.delete(pluginId);
        if (capabilitySet.size === 0) {
          this.capabilities.delete(capability.type);
        }
      }
    }

    this.plugins.delete(pluginId);
    this.emit('plugin-unregistered', { pluginId });
  }

  // ─── Tool Registration ───────────────────────────────────────────────

  registerTool(pluginId: string, tool: Tool): void {
    if (!this.plugins.has(pluginId)) {
      throw new Error(`Plugin ${pluginId} is not registered`);
    }

    // Add to plugin tools
    if (!this.pluginTools.has(pluginId)) {
      this.pluginTools.set(pluginId, []);
    }
    this.pluginTools.get(pluginId)!.push(tool);

    // Register with tool registry
    this.toolRegistry.registerTool(tool);
    this.toolPlugins.set(tool.name, pluginId);

    this.emit('tool-registered', { pluginId, tool });
  }

  unregisterTool(pluginId: string, toolName: string): void {
    if (!this.plugins.has(pluginId)) {
      throw new Error(`Plugin ${pluginId} is not registered`);
    }

    // Remove from plugin tools
    const tools = this.pluginTools.get(pluginId);
    if (tools) {
      const index = tools.findIndex(t => t.name === toolName);
      if (index !== -1) {
        tools.splice(index, 1);
      }
    }

    // Unregister from tool registry
    this.toolRegistry.unregisterTool(toolName);
    this.toolPlugins.delete(toolName);

    this.emit('tool-unregistered', { pluginId, toolName });
  }

  getToolsByPlugin(pluginId: string): Tool[] {
    return this.pluginTools.get(pluginId) || [];
  }

  getPluginByTool(toolName: string): LoadedPlugin | null {
    const pluginId = this.toolPlugins.get(toolName);
    if (pluginId) {
      return this.plugins.get(pluginId) || null;
    }
    return null;
  }

  // ─── Provider Registration ───────────────────────────────────────────

  registerProvider(pluginId: string, provider: any): void {
    if (!this.plugins.has(pluginId)) {
      throw new Error(`Plugin ${pluginId} is not registered`);
    }

    // This would integrate with the provider system
    // For now, just emit an event
    this.emit('provider-registered', { pluginId, provider });
  }

  unregisterProvider(pluginId: string, providerName: string): void {
    if (!this.plugins.has(pluginId)) {
      throw new Error(`Plugin ${pluginId} is not registered`);
    }

    this.emit('provider-unregistered', { pluginId, providerName });
  }

  // ─── Workflow Registration ───────────────────────────────────────────

  registerWorkflow(pluginId: string, workflow: any): void {
    if (!this.plugins.has(pluginId)) {
      throw new Error(`Plugin ${pluginId} is not registered`);
    }

    // This would integrate with the workflow system
    this.emit('workflow-registered', { pluginId, workflow });
  }

  unregisterWorkflow(pluginId: string, workflowName: string): void {
    if (!this.plugins.has(pluginId)) {
      throw new Error(`Plugin ${pluginId} is not registered`);
    }

    this.emit('workflow-unregistered', { pluginId, workflowName });
  }

  // ─── Capability Queries ──────────────────────────────────────────────

  getPluginsByCapability(capability: string): LoadedPlugin[] {
    const pluginIds = this.capabilities.get(capability);
    if (!pluginIds) {
      return [];
    }

    return Array.from(pluginIds)
      .map(id => this.plugins.get(id))
      .filter((p): p is LoadedPlugin => p !== undefined);
  }

  hasCapability(pluginId: string, capability: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return false;
    }

    return plugin.plugin.metadata.capabilities.some(cap => 
      cap.type === capability || cap.name === capability
    );
  }

  getCapabilitiesByPlugin(pluginId: string): PluginCapability[] {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return [];
    }

    return plugin.plugin.metadata.capabilities;
  }

  // ─── Plugin Information ───────────────────────────────────────────────

  getPlugin(pluginId: string): LoadedPlugin | null {
    return this.plugins.get(pluginId) || null;
  }

  getAllPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  getPluginCount(): number {
    return this.plugins.size;
  }

  getToolCount(): number {
    return this.toolPlugins.size;
  }

  // ─── Search and Discovery ────────────────────────────────────────────

  searchPlugins(query: string): LoadedPlugin[] {
    const lowerQuery = query.toLowerCase();
    
    return Array.from(this.plugins.values()).filter(plugin => {
      const metadata = plugin.plugin.metadata;
      
      // Search in name, description, keywords
      return metadata.name.toLowerCase().includes(lowerQuery) ||
             metadata.description.toLowerCase().includes(lowerQuery) ||
             metadata.keywords?.some(keyword => keyword.toLowerCase().includes(lowerQuery)) ||
             metadata.author?.toLowerCase().includes(lowerQuery);
    });
  }

  searchTools(query: string): { tool: Tool; plugin: LoadedPlugin }[] {
    const lowerQuery = query.toLowerCase();
    const results: { tool: Tool; plugin: LoadedPlugin }[] = [];

    for (const [pluginId, tools] of this.pluginTools.entries()) {
      const plugin = this.plugins.get(pluginId);
      if (!plugin) continue;

      for (const tool of tools) {
        if (tool.name.toLowerCase().includes(lowerQuery) ||
            tool.description.toLowerCase().includes(lowerQuery)) {
          results.push({ tool, plugin });
        }
      }
    }

    return results;
  }

  // ─── Statistics and Monitoring ───────────────────────────────────────

  getPluginStats(): {
    total: number;
    active: number;
    inactive: number;
    error: number;
    byCapability: Record<string, number>;
    totalTools: number;
  } {
    const stats = {
      total: this.plugins.size,
      active: 0,
      inactive: 0,
      error: 0,
      byCapability: {} as Record<string, number>,
      totalTools: 0
    };

    for (const plugin of this.plugins.values()) {
      // Count by status
      switch (plugin.status) {
        case 'active':
          stats.active++;
          break;
        case 'inactive':
        case 'loaded':
          stats.inactive++;
          break;
        case 'error':
          stats.error++;
          break;
      }

      // Count capabilities
      for (const capability of plugin.plugin.metadata.capabilities) {
        stats.byCapability[capability.type] = (stats.byCapability[capability.type] || 0) + 1;
      }

      // Count tools
      const tools = this.pluginTools.get(plugin.id);
      if (tools) {
        stats.totalTools += tools.length;
      }
    }

    return stats;
  }

  // ─── Dependency Management ───────────────────────────────────────────

  getPluginDependencies(pluginId: string): string[] {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return [];
    }

    return [
      ...(plugin.plugin.metadata.depends || []),
      ...(plugin.plugin.metadata.peerDepends || [])
    ];
  }

  getPluginDependents(pluginId: string): LoadedPlugin[] {
    const targetPlugin = this.plugins.get(pluginId);
    if (!targetPlugin) {
      return [];
    }

    const targetName = targetPlugin.plugin.metadata.name;
    const dependents: LoadedPlugin[] = [];

    for (const plugin of this.plugins.values()) {
      const dependencies = this.getPluginDependencies(plugin.id);
      if (dependencies.includes(targetName)) {
        dependents.push(plugin);
      }
    }

    return dependents;
  }

  canUnloadPlugin(pluginId: string): boolean {
    const dependents = this.getPluginDependents(pluginId);
    return dependents.length === 0;
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────

  cleanup(): void {
    // Unregister all plugins
    const pluginIds = Array.from(this.plugins.keys());
    for (const pluginId of pluginIds) {
      this.unregisterPlugin(pluginId);
    }

    // Clear all mappings
    this.plugins.clear();
    this.pluginTools.clear();
    this.toolPlugins.clear();
    this.capabilities.clear();

    this.removeAllListeners();
  }
}
