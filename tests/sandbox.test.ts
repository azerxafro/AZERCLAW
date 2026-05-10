import { describe, it, expect } from 'vitest';
import {
  resolveSandboxMode,
  shouldSandboxSession,
  isToolAllowedInSession,
  filterToolDefinitionsForSession,
  auditSandboxPosture,
} from '../src/core/sandbox';

describe('sandbox policy helpers', () => {
  it('keeps backward compatibility for legacy boolean sandboxMode', () => {
    expect(resolveSandboxMode(false)).toBe('off');
    expect(resolveSandboxMode(true)).toBe('all');
    expect(resolveSandboxMode('non-main')).toBe('non-main');
  });

  it('sandboxes only non-main sessions in non-main mode', () => {
    expect(shouldSandboxSession('main', 'non-main')).toBe(false);
    expect(shouldSandboxSession('main:chat', 'non-main')).toBe(false);
    expect(shouldSandboxSession('discord_dm_1', 'non-main')).toBe(true);
  });

  it('enforces denied tools in sandboxed sessions', () => {
    const config = {
      sandboxMode: 'non-main' as const,
      sandboxAllowedTools: ['read_file', 'list_directory'],
      sandboxDeniedTools: ['run_shell', 'write_file', 'spawn_sub_agent'],
    };

    expect(isToolAllowedInSession('read_file', 'discord_dm_1', config)).toBe(true);
    expect(isToolAllowedInSession('run_shell', 'discord_dm_1', config)).toBe(false);
    expect(isToolAllowedInSession('run_shell', 'main', config)).toBe(true);
  });

  it('filters tool definitions based on sandbox policy', () => {
    const definitions = [
      { type: 'function' as const, function: { name: 'read_file', description: '', parameters: {} } },
      { type: 'function' as const, function: { name: 'run_shell', description: '', parameters: {} } },
      { type: 'function' as const, function: { name: 'search_files', description: '', parameters: {} } },
    ];

    const filtered = filterToolDefinitionsForSession(definitions as any, 'slack_chan_1', {
      sandboxMode: 'all',
      sandboxAllowedTools: ['read_file', 'search_files'],
      sandboxDeniedTools: ['run_shell'],
    });

    expect(filtered.map(d => d.function.name)).toEqual(['read_file', 'search_files']);
  });

  it('flags risky posture when channels are enabled and sandbox is off', () => {
    const audit = auditSandboxPosture({
      agent: { sandboxMode: 'off' },
      channels: { discord: { enabled: true }, telegram: { enabled: false }, slack: { enabled: false } },
    });
    expect(audit.failures.length).toBeGreaterThan(0);
  });
});
