import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PairingStore } from '../src/channels/pairing';

function makeTempPairingFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'azerclaw-pairing-'));
  return path.join(dir, 'pairings.json');
}

describe('PairingStore', () => {
  it('creates and approves pairing requests', () => {
    const store = new PairingStore(makeTempPairingFile());
    const pending = store.requestPairing({
      platform: 'discord',
      senderId: 'user-1',
      senderName: 'Alice',
      channelId: 'dm-1',
    });

    expect(pending.code).toHaveLength(6);
    expect(store.isApproved('discord', 'user-1')).toBe(false);

    const approved = store.approve('discord', pending.code);
    expect(approved?.senderId).toBe('user-1');
    expect(store.isApproved('discord', 'user-1')).toBe(true);
  });

  it('treats explicit allowlist as approved access', () => {
    const store = new PairingStore(makeTempPairingFile());
    expect(store.isApproved('telegram', 'user-2', ['user-2'])).toBe(true);
    expect(store.isApproved('telegram', 'user-3', ['*'])).toBe(true);
  });
});
