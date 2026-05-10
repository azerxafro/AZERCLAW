import { describe, it, expect } from 'vitest';
import { resolveSessionIdForMessage } from '../src/channels/routing';

const baseMessage = {
  id: 'm1',
  platform: 'slack',
  channelId: 'C-123',
  senderId: 'U-123',
  senderName: 'alice',
  content: 'hello',
  attachments: [],
  timestamp: new Date(),
  metadata: {},
};

describe('Session routing', () => {
  it('uses platform_channel strategy by default', () => {
    const sessionId = resolveSessionIdForMessage(baseMessage, { strategy: 'platform_channel' });
    expect(sessionId).toBe('slack_c-123');
  });

  it('applies explicit routing rules first', () => {
    const sessionId = resolveSessionIdForMessage(baseMessage, {
      strategy: 'platform_sender',
      rules: [
        { platform: 'slack', channelId: 'C-123', sessionId: 'finance_ops' },
      ],
    });
    expect(sessionId).toBe('finance_ops');
  });

  it('can route per sender', () => {
    const sessionId = resolveSessionIdForMessage(baseMessage, { strategy: 'platform_sender' });
    expect(sessionId).toBe('slack_u-123');
  });
});
