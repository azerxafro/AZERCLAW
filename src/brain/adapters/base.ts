/**
 * 🐟 AZERCLAW Tool-Calling Adapter Base
 * Pluggable interface for converting tool schemas to/from model I/O.
 */

import { ToolDefinition, ToolCall } from '../../providers/base';

export interface AdapterOptions {
  tools: ToolDefinition[];
  systemPrompt?: string;
}

export interface ParsedResponse {
  content: string;
  toolCalls?: ToolCall[];
}

export abstract class BaseToolAdapter {
  abstract readonly name: string;

  /**
   * Inject tool definitions into the prompt / system message.
   * Returns modified messages or system prompt additions.
   */
  abstract injectTools(options: AdapterOptions): { systemAddendum?: string; userAddendum?: string };

  /**
   * Parse raw model output to extract any tool calls.
   */
  abstract parseResponse(rawText: string): ParsedResponse;

  /**
   * Whether this adapter requires tool definitions in the prompt.
   */
  abstract requiresInjection(): boolean;
}
