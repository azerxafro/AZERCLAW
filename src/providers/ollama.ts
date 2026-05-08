/**
 * 🐟 AZERCLAW Ollama Provider (Local Models)
 */

import OpenAI from 'openai';
import { BaseProvider, CompletionOptions, CompletionResult, StreamChunk, ModelInfo } from './base';

export class OllamaProvider extends BaseProvider {
  readonly name = 'ollama';
  readonly displayName = 'Ollama (Local)';
  private client: OpenAI;
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: { baseUrl?: string; defaultModel?: string }) {
    super();
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.defaultModel = config.defaultModel || 'llama3.1';
    this.client = new OpenAI({ apiKey: 'ollama', baseURL: `${this.baseUrl}/v1` });
  }

  async isAvailable(): Promise<boolean> {
    try { const res = await fetch(`${this.baseUrl}/api/tags`); return res.ok; } catch { return false; }
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    const model = options.model || this.defaultModel;
    try {
      const msgs = options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }, ...options.messages] : options.messages;
      const response = await this.client.chat.completions.create({ model, messages: msgs as any, max_tokens: options.maxTokens || 4096, temperature: options.temperature ?? 0.7 });
      return { content: response.choices[0].message?.content || '', model, provider: this.name, finishReason: 'stop' };
    } catch { return { content: '', model, provider: this.name, finishReason: 'error' }; }
  }

  async *stream(options: CompletionOptions): AsyncGenerator<StreamChunk> {
    const model = options.model || this.defaultModel;
    try {
      const msgs = options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }, ...options.messages] : options.messages;
      const stream = await this.client.chat.completions.create({ model, messages: msgs as any, max_tokens: options.maxTokens || 4096, stream: true });
      for await (const chunk of stream) {
        if (chunk.choices[0]?.delta?.content) yield { type: 'text', content: chunk.choices[0].delta.content };
        if (chunk.choices[0]?.finish_reason) yield { type: 'done' };
      }
    } catch (e: any) { yield { type: 'error', error: e.message || 'Ollama connection failed' }; }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      const data = await res.json() as any;
      return (data.models || []).map((m: any) => ({ id: m.name, name: m.name, provider: this.name, contextWindow: 8192, supportsTools: false, supportsStreaming: true }));
    } catch { return []; }
  }

  async validateConnection(): Promise<{ valid: boolean; error?: string }> {
    try { const res = await fetch(`${this.baseUrl}/api/tags`); return res.ok ? { valid: true } : { valid: false, error: `HTTP ${res.status}` }; }
    catch { return { valid: false, error: 'Cannot connect to Ollama' }; }
  }
}
