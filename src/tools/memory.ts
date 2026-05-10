/**
 * 🐟 AZERCLAW Memory Tool
 * Allows the agent to store and retrieve long-term memories.
 */

import { Tool, ToolResult } from './registry';
import { getContextStore } from '../memory/store';

export const memoryTool: Tool = {
  name: 'manage_memory',
  description: 'Manage long-term memory. Use this to remember facts about the user, project preferences, or important discoveries across sessions.',
  version: '1.0.0',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['set', 'get', 'delete', 'search'],
        description: 'Action to perform on memory',
      },
      key: {
        type: 'string',
        description: 'The unique key for the memory entry (e.g., "user_name", "project_goal")',
      },
      value: {
        type: 'string',
        description: 'The value to store (required for "set")',
      },
      query: {
        type: 'string',
        description: 'Search query (required for "search")',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional tags for the memory',
      },
    },
    required: ['action'],
  },
  async execute(args: any): Promise<ToolResult> {
    const store = getContextStore();
    const { action, key, value, query, tags } = args;

    try {
      switch (action) {
        case 'set':
          if (!key || !value) return { success: false, output: '', error: 'Key and value are required for "set"' };
          store.set(key, value, 'agent', tags || []);
          return { success: true, output: `Memory saved: ${key}` };

        case 'get':
          if (!key) return { success: false, output: '', error: 'Key is required for "get"' };
          const val = store.get(key);
          return { success: true, output: val ? `${key}: ${val}` : `Memory not found: ${key}` };

        case 'delete':
          if (!key) return { success: false, output: '', error: 'Key is required for "delete"' };
          const deleted = store.delete(key);
          return { success: true, output: deleted ? `Memory deleted: ${key}` : `Memory not found: ${key}` };

        case 'search':
          if (!query) return { success: false, output: '', error: 'Query is required for "search"' };
          const results = store.search(query);
          if (results.length === 0) return { success: true, output: 'No matching memories found.' };
          const output = results.map(r => `- **${r.key}**: ${r.value}`).join('\n');
          return { success: true, output: `Search results:\n${output}` };

        default:
          return { success: false, output: '', error: `Invalid action: ${action}` };
      }
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  },
};
