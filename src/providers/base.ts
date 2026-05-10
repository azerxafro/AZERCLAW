/**
 * 🐟 AZERCLAW LLM Provider Base Interface
 * All providers implement this interface for unified model access.
 */

// ─── Types ──────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface CompletionOptions {
  messages: ChatMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: ToolDefinition[];
  stream?: boolean;
  systemPrompt?: string;
}

export interface CompletionResult {
  content: string;
  toolCalls?: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: string;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}

export interface StreamChunk {
  type: 'text' | 'tool_call' | 'done' | 'error' | 'usage';
  content?: string;
  toolCall?: ToolCall;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
}

// ─── Base Provider ──────────────────────────────────────────────

export abstract class BaseProvider {
  abstract readonly name: string;
  abstract readonly displayName: string;

  /**
   * Check if the provider is properly configured and reachable.
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Get a chat completion.
   */
  abstract complete(options: CompletionOptions): Promise<CompletionResult>;

  /**
   * Stream a chat completion.
   */
  abstract stream(options: CompletionOptions): AsyncGenerator<StreamChunk>;

  /**
   * List available models from this provider.
   */
  abstract listModels(): Promise<ModelInfo[]>;

  /**
   * Validate the API key / connection.
   */
  abstract validateConnection(): Promise<{ valid: boolean; error?: string }>;
}
