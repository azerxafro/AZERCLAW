/**
 * 🐟 AZERCLAW Anthropic Provider
 * Claude models via the Anthropic API.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  BaseProvider,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
  ModelInfo,
} from './base';

export class AnthropicProvider extends BaseProvider {
  readonly name = 'anthropic';
  readonly displayName = 'Anthropic';
  private client: Anthropic;
  private defaultModel: string;

  constructor(config: { apiKey: string; baseUrl?: string; defaultModel?: string }) {
    super();
    this.defaultModel = config.defaultModel || 'claude-sonnet-4-20250514';
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || undefined,
    });
  }

  async isAvailable(): Promise<boolean> {
    const result = await this.validateConnection();
    return result.valid;
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    const model = options.model || this.defaultModel;

    try {
      const params: Anthropic.MessageCreateParamsNonStreaming = {
        model,
        max_tokens: options.maxTokens || 4096,
        messages: options.messages
          .filter(m => m.role !== 'system')
          .map(m => ({
            role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
            content: m.content,
          })),
      };

      if (options.systemPrompt) {
        params.system = options.systemPrompt;
      } else {
        const sysMsg = options.messages.find(m => m.role === 'system');
        if (sysMsg) {
          params.system = sysMsg.content;
        }
      }

      if (options.tools && options.tools.length > 0) {
        params.tools = options.tools.map(t => ({
          name: t.function.name,
          description: t.function.description,
          input_schema: t.function.parameters as Anthropic.Tool.InputSchema,
        }));
      }

      const response = await this.client.messages.create(params);

      let content = '';
      const toolCalls: any[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          content += block.text;
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            type: 'function',
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input),
            },
          });
        }
      }

      return {
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        model: response.model,
        provider: this.name,
        finishReason: response.stop_reason === 'tool_use' ? 'tool_calls' :
                      response.stop_reason === 'max_tokens' ? 'length' : 'stop',
      };
    } catch (error: any) {
      return {
        content: '',
        model,
        provider: this.name,
        finishReason: 'error',
      };
    }
  }

  async *stream(options: CompletionOptions): AsyncGenerator<StreamChunk> {
    const model = options.model || this.defaultModel;

    try {
      const params: Anthropic.MessageCreateParamsStreaming = {
        model,
        max_tokens: options.maxTokens || 4096,
        stream: true,
        messages: options.messages
          .filter(m => m.role !== 'system')
          .map(m => ({
            role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
            content: m.content,
          })),
      };

      if (options.systemPrompt) {
        params.system = options.systemPrompt;
      }

      const stream = this.client.messages.stream(params);

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          const delta = event.delta as any;
          if (delta.type === 'text_delta') {
            yield { type: 'text', content: delta.text };
          }
        } else if (event.type === 'message_stop') {
          yield { type: 'done' };
        }
      }
    } catch (error: any) {
      yield { type: 'error', error: error.message || 'Unknown error' };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', provider: this.name, contextWindow: 200000, supportsTools: true, supportsStreaming: true },
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: this.name, contextWindow: 200000, supportsTools: true, supportsStreaming: true },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: this.name, contextWindow: 200000, supportsTools: true, supportsStreaming: true },
    ];
  }

  async validateConnection(): Promise<{ valid: boolean; error?: string }> {
    try {
      await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'hi' }],
      });
      return { valid: true };
    } catch (error: any) {
      if (error.status === 401) {
        return { valid: false, error: 'Invalid API key' };
      }
      // Rate limit or other errors still mean connection works
      if (error.status === 429) {
        return { valid: true };
      }
      return { valid: false, error: error.message || 'Connection failed' };
    }
  }
}
