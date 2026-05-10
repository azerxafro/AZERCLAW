/**
 * 🐟 AZERCLAW OpenAI Provider
 * Supports OpenAI API and any OpenAI-compatible endpoints.
 */

import OpenAI from 'openai';
import {
  BaseProvider,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
  ModelInfo,
  ChatMessage,
} from './base';

export class OpenAIProvider extends BaseProvider {
  readonly name: string = 'openai';
  readonly displayName: string = 'OpenAI';
  protected client: OpenAI;
  protected apiKey: string;
  protected baseUrl: string;
  protected defaultModel: string;

  constructor(config: { apiKey: string; baseUrl?: string; defaultModel?: string }) {
    super();
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.defaultModel = config.defaultModel || 'gpt-4o';
    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
    });
  }

  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.validateConnection();
      return result.valid;
    } catch {
      return false;
    }
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    const messages = this.formatMessages(options);
    const model = options.model || this.defaultModel;

    try {
      const params: OpenAI.ChatCompletionCreateParamsNonStreaming = {
        model,
        messages: messages as OpenAI.ChatCompletionMessageParam[],
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.7,
      };

      if (options.tools && options.tools.length > 0) {
        params.tools = options.tools as OpenAI.ChatCompletionTool[];
      }

      const response = await this.client.chat.completions.create(params);
      const choice = response.choices[0];

      return {
        content: choice.message?.content || '',
        toolCalls: choice.message?.tool_calls?.map((tc: any) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
        model: response.model,
        provider: this.name,
        finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : 
                      choice.finish_reason === 'length' ? 'length' : 'stop',
      };
    } catch (error: any) {
      return {
        content: `Provider error: ${error.message || 'Unknown error'}`,
        model,
        provider: this.name,
        finishReason: 'error',
      };
    }
  }

  async *stream(options: CompletionOptions): AsyncGenerator<StreamChunk> {
    const messages = this.formatMessages(options);
    const model = options.model || this.defaultModel;

    try {
      const params: OpenAI.ChatCompletionCreateParamsStreaming = {
        model,
        messages: messages as OpenAI.ChatCompletionMessageParam[],
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.7,
        stream: true,
      };

      if (options.tools && options.tools.length > 0) {
        params.tools = options.tools as OpenAI.ChatCompletionTool[];
      }

      const stream = await this.client.chat.completions.create(params);

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        
        if (delta?.content) {
          yield { type: 'text', content: delta.content };
        }
        
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            yield {
              type: 'tool_call',
              toolCall: {
                id: tc.id || '',
                type: 'function',
                function: {
                  name: tc.function?.name || '',
                  arguments: tc.function?.arguments || '',
                },
              },
            };
          }
        }

        if (chunk.choices[0]?.finish_reason) {
          yield { type: 'done' };
        }
      }
    } catch (error: any) {
      yield { type: 'error', error: error.message || 'Unknown error' };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const models = await this.client.models.list();
      return models.data
        .filter(m => m.id.includes('gpt') || m.id.includes('o1') || m.id.includes('o3') || m.id.includes('o4'))
        .map(m => ({
          id: m.id,
          name: m.id,
          provider: this.name,
          contextWindow: this.getContextWindow(m.id),
          supportsTools: true,
          supportsStreaming: true,
        }));
    } catch {
      return this.getDefaultModels();
    }
  }

  async validateConnection(): Promise<{ valid: boolean; error?: string }> {
    try {
      await this.client.models.list();
      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: error.message || 'Connection failed' };
    }
  }

  private formatMessages(options: CompletionOptions): ChatMessage[] {
    const messages: ChatMessage[] = [];
    
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    
    messages.push(...options.messages);
    return messages;
  }

  private getContextWindow(modelId: string): number {
    if (modelId.includes('gpt-4o')) return 128000;
    if (modelId.includes('gpt-4-turbo')) return 128000;
    if (modelId.includes('gpt-4.1')) return 1047576;
    if (modelId.includes('o3')) return 200000;
    if (modelId.includes('o4-mini')) return 200000;
    return 128000;
  }

  private getDefaultModels(): ModelInfo[] {
    return [
      { id: 'gpt-4o', name: 'GPT-4o', provider: this.name, contextWindow: 128000, supportsTools: true, supportsStreaming: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: this.name, contextWindow: 128000, supportsTools: true, supportsStreaming: true },
      { id: 'gpt-4.1', name: 'GPT-4.1', provider: this.name, contextWindow: 1047576, supportsTools: true, supportsStreaming: true },
      { id: 'o3', name: 'o3', provider: this.name, contextWindow: 200000, supportsTools: true, supportsStreaming: true },
      { id: 'o4-mini', name: 'o4-mini', provider: this.name, contextWindow: 200000, supportsTools: true, supportsStreaming: true },
    ];
  }
}
