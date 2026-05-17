/**
 * 🐟 AZERCLAW Prompt Injection Tool Adapter
 * Injects JSON tool schemas into system prompt and parses tool calls from text.
 * Works with any text-completion model.
 */

import { BaseToolAdapter, AdapterOptions, ParsedResponse } from './base';
import { ToolCall } from '../../providers/base';

export class PromptInjectionAdapter extends BaseToolAdapter {
  readonly name = 'prompt-injection';

  injectTools(options: AdapterOptions): { systemAddendum?: string; userAddendum?: string } {
    if (!options.tools || options.tools.length === 0) {
      return {};
    }

    const toolDescriptions = options.tools.map(tool => {
      const fn = tool.function;
      return `- ${fn.name}: ${fn.description}\n  Parameters: ${JSON.stringify(fn.parameters)}`;
    }).join('\n');

    const addendum = `\n\nYou have access to the following tools. When you need to use a tool, output a JSON object inside a <tool_call> block like this:

<tool_call>
{
  "name": "tool_name",
  "arguments": { "key": "value" }
}
</tool_call>

Available tools:\n${toolDescriptions}\n\nIf you don't need a tool, respond normally.`;

    return { systemAddendum: addendum };
  }

  parseResponse(rawText: string): ParsedResponse {
    const toolCalls: ToolCall[] = [];
    let content = rawText;

    // Match <tool_call> ... </tool_call> blocks
    const toolCallRegex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
    let match: RegExpExecArray | null;

    while ((match = toolCallRegex.exec(rawText)) !== null) {
      try {
        const jsonText = match[1].trim();
        // Strip markdown fences if present
        const cleanJson = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
        const parsed = JSON.parse(cleanJson);

        if (parsed.name && parsed.arguments !== undefined) {
          toolCalls.push({
            id: `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: 'function',
            function: {
              name: String(parsed.name),
              arguments: typeof parsed.arguments === 'string'
                ? parsed.arguments
                : JSON.stringify(parsed.arguments),
            },
          });
        }
      } catch {
        // Malformed tool call — skip
      }
    }

    // Remove tool_call blocks from content
    content = rawText.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '').trim();

    // Also try inline JSON ```json blocks that look like tool calls
    const inlineJsonRegex = /```json\s*\n?\s*\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*(\{[\s\S]*?\})\s*\}\s*```/g;
    let inlineMatch: RegExpExecArray | null;
    while ((inlineMatch = inlineJsonRegex.exec(rawText)) !== null) {
      try {
        const args = inlineMatch[2];
        toolCalls.push({
          id: `prompt_inline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          type: 'function',
          function: {
            name: inlineMatch[1],
            arguments: args,
          },
        });
        // Remove from content if not already removed
        content = content.replace(inlineMatch[0], '').trim();
      } catch {
        // Skip malformed
      }
    }

    return { content, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
  }

  requiresInjection(): boolean {
    return true;
  }
}
