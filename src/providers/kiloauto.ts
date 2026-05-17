/**
 * 🐟 AZERCLAW KiloAuto Provider
 * Fetch-based provider for https://api.kilo.ai/auto free tier.
 */

import {
  BaseProvider,
  ChatMessage,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
  ModelInfo,
  ToolCall,
} from './base';

export class KiloAutoProvider extends BaseProvider {
  readonly name = 'kiloauto';
  readonly displayName = 'KiloAuto';

  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: { apiKey: string; baseUrl?: string; defaultModel?: string }) {
    super();
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || 'https://api.kilo.ai/auto').replace(/\/$/, '');
    this.defaultModel = config.defaultModel || 'kilo-auto-v1';
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
    const model = options.model || this.defaultModel;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: this.formatMessages(options),
          max_tokens: options.maxTokens || 4096,
          temperature: options.temperature ?? 0.7,
          tools: options.tools && options.tools.length > 0 ? options.tools : undefined,
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => 'Unknown error');
        return {
          content: `KiloAuto HTTP ${response.status}: ${text}`,
          model,
          provider: this.name,
          finishReason: 'error',
        };
      }

      const data = await response.json() as any;

      if (!data.choices || data.choices.length === 0) {
        return {
          content: `KiloAuto error: ${data.error?.message || 'Empty response'}`,
          model,
          provider: this.name,
          finishReason: 'error',
        };
      }

      const choice = data.choices[0];
      const message = choice.message || {};

      return {
        content: message.content || '',
        toolCalls: Array.isArray(message.tool_calls)
          ? message.tool_calls.map((tc: any) => ({
              id: tc.id || '',
              type: 'function' as const,
              function: {
                name: tc.function?.name || '',
                arguments: tc.function?.arguments || '',
              },
            }))
          : undefined,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
        model: data.model || model,
        provider: this.name,
        finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' :
                      choice.finish_reason === 'length' ? 'length' : 'stop',
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: `KiloAuto provider error: ${msg}`,
        model,
        provider: this.name,
        finishReason: 'error',
      };
    }
  }

  async *stream(options: CompletionOptions): AsyncGenerator<StreamChunk> {
    const model = options.model || this.defaultModel;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: this.formatMessages(options),
          max_tokens: options.maxTokens || 4096,
          temperature: options.temperature ?? 0.7,
          stream: true,
          tools: options.tools && options.tools.length > 0 ? options.tools : undefined,
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => 'Unknown error');
        yield { type: 'error', error: `KiloAuto HTTP ${response.status}: ${text}` };
        return;
      }

      if (!response.body) {
        yield { type: 'error', error: 'KiloAuto: empty response body' };
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const chunk = JSON.parse(trimmed.slice(6));
            const delta = chunk.choices?.[0]?.delta;
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
            if (chunk.choices?.[0]?.finish_reason) {
              yield { type: 'done' };
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } catch (error: unknown) {
      yield { type: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });
      if (!response.ok) return this.getDefaultModels();
      const data = await response.json() as any;
      const models = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
      return models.map((m: any) => ({
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
      await Promise.race([
        fetch(`${this.baseUrl}/models`, {
          headers: { 'Authorization': `Bearer ${this.apiKey}` },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Connection timed out (10s)')), 10000)
        ),
      ]);
      return { valid: true };
    } catch (error: unknown) {
      return { valid: false, error: error instanceof Error ? error.message : 'Connection failed' };
    }
  }

  private formatMessages(options: CompletionOptions): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    for (const msg of options.messages) {
      messages.push({ role: msg.role, content: msg.content });
    }
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
      { id: this.defaultModel, name: this.defaultModel, provider: this.name, contextWindow: 128000, supportsTools: true, supportsStreaming: true, description: 'FREE · KiloAuto' },
    ];
  }
}
