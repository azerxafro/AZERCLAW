import { describe, it, expect } from 'vitest';
import { ProviderRouter } from '../src/providers/router';

describe('ProviderRouter', () => {
  it('should instantiate without crashing', () => {
    const router = new ProviderRouter();
    expect(router).toBeDefined();
  });

  it('should return available providers based on default config', () => {
    const router = new ProviderRouter();
    const available = router.getAvailableProviders();
    expect(Array.isArray(available)).toBe(true);
  });
});
