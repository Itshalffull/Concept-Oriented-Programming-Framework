import { describe, it, expect } from 'vitest';
import { bootKernel } from '../handlers/ts/framework/kernel-boot.handler.js';

describe('kernel-boot', () => {
  it('loads', () => {
    expect(typeof bootKernel).toBe('function');
  });
});
