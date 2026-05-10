import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ChannelAdapter, NormalizedMessage, SendOptions } from '../src/channels/adapter';
import { PairingStore } from '../src/channels/pairing';

function makeTempPairingFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'azerclaw-dm-policy-'));
  return path.join(dir, 'pairings.json');
}

class TestAdapter extends ChannelAdapter {
  readonly displayName = 'Test Adapter';
  private store: PairingStore;
  private policy: 'pairing' | 'open' | 'closed';
  private allowFrom: string[];
  public sent: SendOptions[] = [];

  constructor(
    readonly platform: string,
    policy: 'pairing' | 'open' | 'closed',
    allowFrom: string[] = []
  ) {
    super();
    this.policy = policy;
    this.allowFrom = allowFrom;
    this.store = new PairingStore(makeTempPairingFile());
  }

  async connect(_config: Record<string, string>): Promise<void> {}
  async disconnect(): Promise<void> {}
  isConnected(): boolean { return true; }

  async send(options: SendOptions): Promise<void> {
    this.sent.push(options);
  }

  async checkPolicy(message: NormalizedMessage): Promise<boolean> {
    return this.enforceDmPolicy(message);
  }

  getPairingCode(platform: string): string {
    const pending = this.store.listPending(platform);
    if (pending.length === 0) throw new Error('No pending code');
    return pending[0].code;
  }

  approve(platform: string, code: string): boolean {
    return !!this.store.approve(platform, code);
  }

  revoke(platform: string, senderId: string): boolean {
    return this.store.revoke(platform, senderId);
  }

  protected getPairingStore(): PairingStore {
    return this.store;
  }

  protected getChannelSecurityConfig(): { dmPolicy: 'pairing' | 'open' | 'closed'; allowFrom: string[] } {
    return { dmPolicy: this.policy, allowFrom: this.allowFrom };
  }
}

function baseMessage(platform: string): NormalizedMessage {
  return {
    id: 'm1',
    platform,
    channelId: 'chan-1',
    senderId: 'user-1',
    senderName: 'Alice',
    content: 'hello',
    attachments: [],
    timestamp: new Date(),
    metadata: {},
  };
}

describe('DM policy enforcement', () => {
  it('enforces pairing then allows approved sender in Discord DM', async () => {
    const adapter = new TestAdapter('discord', 'pairing');
    const message = baseMessage('discord');

    const first = await adapter.checkPolicy(message);
    expect(first).toBe(false);
    expect(adapter.sent[0].content).toContain('azerclaw pairing approve discord');

    const code = adapter.getPairingCode('discord');
    expect(adapter.approve('discord', code)).toBe(true);

    const second = await adapter.checkPolicy(message);
    expect(second).toBe(true);

    expect(adapter.revoke('discord', message.senderId)).toBe(true);
    const third = await adapter.checkPolicy(message);
    expect(third).toBe(false);
  });

  it('blocks all Telegram DMs when policy is closed', async () => {
    const adapter = new TestAdapter('telegram', 'closed');
    const message = baseMessage('telegram');
    message.metadata = { chatType: 'private' };

    const allowed = await adapter.checkPolicy(message);
    expect(allowed).toBe(false);
    expect(adapter.sent[0].content).toContain('disabled');
  });

  it('enforces Slack allowlist when policy is open', async () => {
    const adapter = new TestAdapter('slack', 'open', ['user-allowed']);
    const blockedMsg = baseMessage('slack');
    blockedMsg.metadata = { channelType: 'im' };

    const blocked = await adapter.checkPolicy(blockedMsg);
    expect(blocked).toBe(false);
    expect(adapter.sent[0].content).toContain('restricted');

    const allowedMsg = { ...blockedMsg, senderId: 'user-allowed' };
    const allowed = await adapter.checkPolicy(allowedMsg);
    expect(allowed).toBe(true);
  });
});
