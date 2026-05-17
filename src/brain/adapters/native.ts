/**
 * 🐟 AZERCLAW Native Tool Adapter
 * Passthrough for models with native tool support (OpenAI-compatible).
 */

import { BaseToolAdapter, AdapterOptions, ParsedResponse } from './base';

export class NativeToolAdapter extends BaseToolAdapter {
  readonly name = 'native';

  injectTools(_options: AdapterOptions): { systemAddendum?: string; userAddendum?: string } {
    // Native adapters don't need prompt injection; tools are passed via API schema
    return {};
  }

  parseResponse(rawText: string): ParsedResponse {
    // Native adapters expect tool calls to be parsed by the provider itself
    // This is a fallback for any text that leaks through
    return { content: rawText };
  }

  requiresInjection(): boolean {
    return false;
  }
}
