/**
 * 🐟 AZERCLAW HuggingFace Provider
 * Inference API provider for HuggingFace free tier endpoints.
 */

import {
  BaseProvider,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
  ModelInfo,
} from './base';

export class HuggingFaceProvider extends BaseProvider {
  readonly name = 'huggingface';
  readonly displayName = 'HuggingFace';

  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: { apiKey: string; baseUrl?: string; defaultModel?: string }) {
    super();
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || 'https://api-inference.huggingface.co/models').replace(/\/$/, '');
    this.defaultModel = config.defaultModel || 'meta-llama/Llama-3.2-1B-Instruct';
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
      const response = await fetch(`${this.baseUrl}/${model}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          inputs: this.formatPrompt(options),
          parameters: {
            max_new_tokens: options.maxTokens || 4096,
            temperature: options.temperature ?? 0.7,
            return_full_text: false,
          },
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => 'Unknown error');
        return {
          content: `HuggingFace HTTP ${response.status}: ${text}`,
          model,
          provider: this.name,
          finishReason: 'error',
        };
      }

      const data = await response.json() as any;

      // HF inference API can return an array of generated texts
      let text = '';
      if (Array.isArray(data) && data.length > 0) {
        text = data[0].generated_text || String(data[0]);
      } else if (typeof data === 'string') {
        text = data;
      } else if (data.generated_text) {
        text = data.generated_text;
      } else {
        text = JSON.stringify(data);
      }

      return {
        content: text,
        model,
        provider: this.name,
        finishReason: 'stop',
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: `HuggingFace provider error: ${msg}`,
        model,
        provider: this.name,
        finishReason: 'error',
      };
    }
  }

  async *stream(options: CompletionOptions): AsyncGenerator<StreamChunk> {
    // HF free tier inference API does not support streaming in the same way
    // Fall back to complete and yield the full result as a single text chunk
    const result = await this.complete(options);
    if (result.finishReason === 'error') {
      yield { type: 'error', error: result.content };
      return;
    }
    yield { type: 'text', content: result.content };
    yield { type: 'done' };
  }

  async listModels(): Promise<ModelInfo[]> {
    // HF doesn't have a single "list models" endpoint for inference API
    // Return a curated list of known free-tier conversational models
    return [
      { id: 'meta-llama/Llama-3.2-1B-Instruct', name: 'Llama 3.2 1B', provider: this.name, contextWindow: 128000, supportsTools: false, supportsStreaming: false, description: 'FREE · Small & fast' },
      { id: 'meta-llama/Llama-3.2-3B-Instruct', name: 'Llama 3.2 3B', provider: this.name, contextWindow: 128000, supportsTools: false, supportsStreaming: false, description: 'FREE · Balanced' },
      { id: 'mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B', provider: this.name, contextWindow: 32000, supportsTools: false, supportsStreaming: false, description: 'FREE · Capable' },
      { id: 'microsoft/DialoGPT-medium', name: 'DialoGPT', provider: this.name, contextWindow: 1024, supportsTools: false, supportsStreaming: false, description: 'FREE · Chat' },
    ];
  }

  async validateConnection(): Promise<{ valid: boolean; error?: string }> {
    try {
      const response = await Promise.race([
        fetch(`${this.baseUrl}/${this.defaultModel}`, {
          method: 'HEAD',
          headers: { 'Authorization': `Bearer ${this.apiKey}` },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Connection timed out (10s)')), 10000)
        ),
      ]);
      return { valid: (response as Response).ok || (response as Response).status === 405 };
    } catch (error: unknown) {
      return { valid: false, error: error instanceof Error ? error.message : 'Connection failed' };
    }
  }

  private formatPrompt(options: CompletionOptions): string {
    // Build a simple chat prompt for instruction-tuned models
    const parts: string[] = [];
    if (options.systemPrompt) {
      parts.push(`System: ${options.systemPrompt}`);
    }
    for (const msg of options.messages) {
      const roleLabel = msg.role === 'assistant' ? 'Assistant' : msg.role === 'user' ? 'User' : 'System';
      parts.push(`${roleLabel}: ${msg.content}`);
    }
    parts.push('Assistant:');
    return parts.join('\n\n');
  }
}
