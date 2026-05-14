import { describe, it, expect } from 'vitest';
import { PromptInjectionAdapter, NativeToolAdapter, getAdapter } from '../src/brain/adapters';

describe('PromptInjectionAdapter', () => {
  const adapter = new PromptInjectionAdapter();

  it('should require injection', () => {
    expect(adapter.requiresInjection()).toBe(true);
  });

  it('should return empty addendum when no tools', () => {
    const result = adapter.injectTools({ tools: [] });
    expect(result.systemAddendum).toBeUndefined();
  });

  it('should inject tool schemas into system addendum', () => {
    const tools = [
      {
        type: 'function' as const,
        function: {
          name: 'read_file',
          description: 'Read a file',
          parameters: { type: 'object', properties: { path: { type: 'string' } } },
        },
      },
    ];
    const result = adapter.injectTools({ tools });
    expect(result.systemAddendum).toContain('read_file');
    expect(result.systemAddendum).toContain('<tool_call>');
  });

  it('should parse tool calls from <tool_call> blocks', () => {
    const raw = `I'll read the file for you.

<tool_call>
{
  "name": "read_file",
  "arguments": { "path": "/tmp/test.txt" }
}
</tool_call>`;

    const parsed = adapter.parseResponse(raw);
    expect(parsed.content.trim()).toBe("I'll read the file for you.");
    expect(parsed.toolCalls).toHaveLength(1);
    expect(parsed.toolCalls![0].function.name).toBe('read_file');
    expect(parsed.toolCalls![0].function.arguments).toContain('/tmp/test.txt');
  });

  it('should parse tool calls from markdown json blocks', () => {
    const raw = `Here's the result.

\`\`\`json
{"name": "run_shell", "arguments": {"command": "ls -la"}}
\`\`\``;

    const parsed = adapter.parseResponse(raw);
    expect(parsed.toolCalls).toHaveLength(1);
    expect(parsed.toolCalls![0].function.name).toBe('run_shell');
  });

  it('should handle malformed tool calls gracefully', () => {
    const raw = `Some text
<tool_call>
not valid json
</tool_call>
More text`;

    const parsed = adapter.parseResponse(raw);
    expect(parsed.content).toContain('Some text');
    expect(parsed.toolCalls).toBeUndefined();
  });

  it('should handle no tool calls', () => {
    const raw = 'Just a normal response.';
    const parsed = adapter.parseResponse(raw);
    expect(parsed.content).toBe('Just a normal response.');
    expect(parsed.toolCalls).toBeUndefined();
  });
});

describe('NativeToolAdapter', () => {
  const adapter = new NativeToolAdapter();

  it('should not require injection', () => {
    expect(adapter.requiresInjection()).toBe(false);
  });

  it('should return empty addendum', () => {
    const result = adapter.injectTools({ tools: [{ type: 'function', function: { name: 'x', description: 'y', parameters: {} } }] });
    expect(result.systemAddendum).toBeUndefined();
  });

  it('should passthrough raw text', () => {
    const parsed = adapter.parseResponse('Hello world');
    expect(parsed.content).toBe('Hello world');
    expect(parsed.toolCalls).toBeUndefined();
  });
});

describe('Adapter Registry', () => {
  it('should return prompt-injection for huggingface', () => {
    const adapter = getAdapter('huggingface');
    expect(adapter.name).toBe('prompt-injection');
  });

  it('should return native for opencode', () => {
    const adapter = getAdapter('opencode');
    expect(adapter.name).toBe('native');
  });

  it('should return prompt-injection for unknown providers', () => {
    const adapter = getAdapter('unknown-provider');
    expect(adapter.name).toBe('prompt-injection');
  });
});
