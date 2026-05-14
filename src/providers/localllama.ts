/**
 * 🐟 AZERCLAW LocalLlama Provider
 * Ollama-compatible local provider for self-hosted free models.
 */

import {
  BaseProvider,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
  ModelInfo,
} from './base';

export class LocalLlamaProvider extends BaseProvider {
  readonly name = 'localllama';
  readonly displayName = 'LocalLlama';

  private baseUrl: string;
  private defaultModel: string;

  constructor(config: { baseUrl?: string; defaultModel?: string }) {
    super();
    this.baseUrl = (config.baseUrl || 'http://localhost:11434').replace(/\/$/, '');
    this.defaultModel = config.defaultModel || 'llama3.2';
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
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: this.formatMessages(options),
          stream: false,
          options: {
            num_predict: options.maxTokens || 4096,
            temperature: options.temperature ?? 0.7,
          },
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => 'Unknown error');
        return {
          content: `LocalLlama HTTP ${response.status}: ${text}`,
          model,
          provider: this.name,
          finishReason: 'error',
        };
      }

      const data = await response.json() as any;
      const message = data.message || {};

      return {
        content: message.content || '',
        model,
        provider: this.name,
        finishReason: 'stop',
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: `LocalLlama provider error: ${msg}`,
        model,
        provider: this.name,
        finishReason: 'error',
      };
    }
  }

  async *stream(options: CompletionOptions): AsyncGenerator<StreamChunk> {
    const model = options.model || this.defaultModel;

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: this.formatMessages(options),
          stream: true,
          options: {
            num_predict: options.maxTokens || 4096,
            temperature: options.temperature ?? 0.7,
          },
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => 'Unknown error');
        yield { type: 'error', error: `LocalLlama HTTP ${response.status}: ${text}` };
        return;
      }

      if (!response.body) {
        yield { type: 'error', error: 'LocalLlama: empty response body' };
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              yield { type: 'text', content: data.message.content };
            }
            if (data.done) {
              yield { type: 'done' };
            }
          } catch {
            // Skip malformed NDJSON lines
          }
        }
      }
    } catch (error: unknown) {
      yield { type: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return this.getDefaultModels();
      const data = await response.json() as any;
      const models = Array.isArray(data.models) ? data.models : [];
      return models.map((m: any) => ({
        id: m.name || m.model || 'unknown',
        name: m.name || m.model || 'unknown',
        provider: this.name,
        contextWindow: 128000,
        supportsTools: false,
        supportsStreaming: true,
      }));
    } catch {
      return this.getDefaultModels();
    }
  }

  async validateConnection(): Promise<{ valid: boolean; error?: string }> {
    try {
      await Promise.race([
        fetch(`${this.baseUrl}/api/tags`),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Connection timed out (5s)')), 5000)
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

  private getDefaultModels(): ModelInfo[] {
    return [
      { id: this.defaultModel, name: this.defaultModel, provider: this.name, contextWindow: 128000, supportsTools: false, supportsStreaming: true, description: 'FREE · Local' },
    ];
  }
}
