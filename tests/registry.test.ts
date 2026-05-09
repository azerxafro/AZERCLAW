import { describe, it, expect, beforeEach } from 'vitest';
import { getToolRegistry } from '../src/tools/registry';
import { shellTool } from '../src/tools/shell';

describe('ToolRegistry', () => {
  beforeEach(() => {
    // Reset registry by getting a fresh instance if possible,
    // but getToolRegistry is a singleton.
    const registry = getToolRegistry();
    // Register shell tool manually for test if needed.
    registry.register(shellTool);
  });

  it('should register and retrieve a tool', () => {
    const registry = getToolRegistry();
    const tools = registry.getDefinitions();
    
    const hasShell = tools.some(t => t.function.name === 'run_shell');
    expect(hasShell).toBe(true);
  });
});
