/**
 * 🐟 AZERCLAW Google Gemini Provider
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  BaseProvider,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
  ModelInfo,
} from './base';

export class GoogleProvider extends BaseProvider {
  readonly name = 'google';
  readonly displayName = 'Google Gemini';
  private client: GoogleGenerativeAI;
  private defaultModel: string;

  constructor(config: { apiKey: string; defaultModel?: string }) {
    super();
    this.defaultModel = config.defaultModel || 'gemini-2.5-flash';
    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  async isAvailable(): Promise<boolean> {
    const result = await this.validateConnection();
    return result.valid;
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    const modelId = options.model || this.defaultModel;

    try {
      const model = this.client.getGenerativeModel({ model: modelId });
      
      const systemPrompt = options.systemPrompt || 
        options.messages.find(m => m.role === 'system')?.content || '';
      
      const history = options.messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

      // Get the last user message
      const lastMessage = history.pop();
      if (!lastMessage) {
        return { content: '', model: modelId, provider: this.name, finishReason: 'error' };
      }

      const chat = model.startChat({
        history: history as any,
        systemInstruction: systemPrompt ? { role: 'system' as any, parts: [{ text: systemPrompt }] } as any : undefined,
      });

      const result = await chat.sendMessage(lastMessage.parts[0].text);
      const response = result.response;

      return {
        content: response.text(),
        model: modelId,
        provider: this.name,
        finishReason: 'stop',
        usage: response.usageMetadata ? {
          promptTokens: response.usageMetadata.promptTokenCount || 0,
          completionTokens: response.usageMetadata.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata.totalTokenCount || 0,
        } : undefined,
      };
    } catch (error: any) {
      return { content: '', model: modelId, provider: this.name, finishReason: 'error' };
    }
  }

  async *stream(options: CompletionOptions): AsyncGenerator<StreamChunk> {
    const modelId = options.model || this.defaultModel;

    try {
      const model = this.client.getGenerativeModel({ model: modelId });
      
      const systemPrompt = options.systemPrompt || 
        options.messages.find(m => m.role === 'system')?.content || '';
      
      const history = options.messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

      const lastMessage = history.pop();
      if (!lastMessage) {
        yield { type: 'error', error: 'No messages provided' };
        return;
      }

      const chat = model.startChat({
        history: history as any,
        systemInstruction: systemPrompt ? { role: 'system' as any, parts: [{ text: systemPrompt }] } as any : undefined,
      });

      const result = await chat.sendMessageStream(lastMessage.parts[0].text);

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield { type: 'text', content: text };
        }
      }

      yield { type: 'done' };
    } catch (error: any) {
      yield { type: 'error', error: error.message || 'Unknown error' };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: this.name, contextWindow: 1048576, supportsTools: true, supportsStreaming: true },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: this.name, contextWindow: 1048576, supportsTools: true, supportsStreaming: true },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: this.name, contextWindow: 1048576, supportsTools: true, supportsStreaming: true },
    ];
  }

  async validateConnection(): Promise<{ valid: boolean; error?: string }> {
    try {
      const model = this.client.getGenerativeModel({ model: this.defaultModel });
      await model.generateContent('test');
      return { valid: true };
    } catch (error: any) {
      if (error.message?.includes('API_KEY')) {
        return { valid: false, error: 'Invalid API key' };
      }
      return { valid: false, error: error.message || 'Connection failed' };
    }
  }
}
