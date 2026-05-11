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
      const resData = response as any;

      // Handle Cloudflare-style errors inside a 200 OK response
      if (resData.success === false && resData.errors && resData.errors.length > 0) {
        return {
          content: `Cloudflare Error: ${resData.errors[0].message}`,
          model,
          provider: this.name,
          finishReason: 'error',
        };
      }

      const choice = response.choices[0];
      const message = choice.message as any;

      // Extract content, falling back to reasoning/thought if content is null
      let content = message.content || '';
      if (!content && (message.reasoning_content || message.thought)) {
        content = message.reasoning_content || message.thought;
      }

      return {
        content,
        toolCalls: message.tool_calls?.map((tc: any) => ({
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
      let errorMsg = error.message || 'Unknown error';
      
      if (process.env.AZERCLAW_DEBUG) {
        console.error(`[OpenAIProvider] Error:`, error);
      }

      // If the proxy (Vought Gate) returned a specific auth failure, pass it through
      if (error.response && error.response.data && error.response.data.error === 'VOUGHT_GATE_AUTH_FAILURE') {
        errorMsg = `VOUGHT_GATE_AUTH_FAILURE: ${error.response.data.message}`;
      } else if (error.error && error.error.error === 'VOUGHT_GATE_AUTH_FAILURE') {
        errorMsg = `VOUGHT_GATE_AUTH_FAILURE: ${error.error.message}`;
      }

      return {
        content: `Provider error: ${errorMsg}`,
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
    if (modelId.includes('128k')) return 128000;
    if (modelId.includes('200k')) return 200000;
    if (modelId.includes('1m')) return 1000000;
    return 128000;
  }

  private getDefaultModels(): ModelInfo[] {
    return [
      { id: this.defaultModel, name: this.defaultModel, provider: this.name, contextWindow: 128000, supportsTools: true, supportsStreaming: true, description: 'FREE · Default Engine' },
    ];
  }
}
