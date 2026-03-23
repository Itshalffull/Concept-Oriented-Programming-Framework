import { describe, it, expect } from 'vitest';
// This simulates what score-kernel does: import from a sibling directory
import { bootKernel } from '../handlers/ts/framework/kernel-boot.handler.js';

describe('sideways', () => {
  it('loads kernel-boot', () => {
    expect(typeof bootKernel).toBe('function');
  });
});
