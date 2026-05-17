import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { getToolRegistry, Tool } from './registry';

export class ToolLoader {
  private registry = getToolRegistry();

  /**
   * Dynamically loads all JS/TS tools from a given directory.
   */
  async loadFromDirectory(directory: string): Promise<void> {
    try {
      if (!existsSync(directory)) {
        // Silently skip if directory doesn't exist (normal for default plugin paths)
        return;
      }

      const stats = await fs.stat(directory);
      if (!stats.isDirectory()) {
        console.warn(`[ToolLoader] Path is not a directory: ${directory}`);
        return;
      }

      const files = await fs.readdir(directory);
      let count = 0;
      
      for (const file of files) {
        if (file.endsWith('.js') || (file.endsWith('.ts') && !file.endsWith('.d.ts'))) {
          // Skip internal tool files
          if (['index.ts', 'loader.ts', 'registry.ts', 'shell.ts', 'filesystem.ts', 'advanced.ts'].includes(file)) {
            continue;
          }
          
          const fullPath = path.join(directory, file);
          await this.loadPlugin(fullPath);
          count++;
        }
      }
      
      if (count > 0 && process.env.AZERCLAW_DEBUG) {
        console.log(`[ToolLoader] Loaded ${count} tools from ${directory}`);
      }
    } catch (error: any) {
      console.error(`[ToolLoader] Failed to load tools from directory ${directory}:`, error.message);
    }
  }

  /**
   * Loads a single tool plugin from a file.
   * Expects the default export to be an object conforming to the Tool interface.
   */
  async loadPlugin(filePath: string): Promise<void> {
    try {
      // Resolve absolute path for dynamic import
      const absolutePath = path.resolve(filePath);
      
      // Use dynamic import to load the module
      // Note: for .ts files, we expect them to be pre-compiled or handled by ts-node/tsx
      const module = await import(absolutePath);
      const tool: Tool = module.default || module;

      if (!tool || !tool.name || typeof tool.execute !== 'function') {
        console.warn(`[ToolLoader] Invalid plugin format in ${filePath}. Must export a Tool object.`);
        return;
      }

      // Ensure version exists (fallback for legacy plugins)
      if (!tool.version) {
        tool.version = '0.0.1-legacy';
      }

      this.registry.register(tool);
      if (process.env.AZERCLAW_DEBUG) {
        console.log(`[ToolLoader] Registered tool: ${tool.name} (v${tool.version})`);
      }

    } catch (error: any) {
      console.error(`[ToolLoader] Failed to load plugin ${filePath}:`, error.message);
    }
  }
}

// Singleton for easy access
let instance: ToolLoader | null = null;
export function getToolLoader(): ToolLoader {
  if (!instance) instance = new ToolLoader();
  return instance;
}

