import { describe, it, expect } from 'vitest';
import { scoreKernelHandler } from '../handlers/ts/score/score-kernel.handler.js';

describe('sk', () => {
  it('loads', () => {
    expect(scoreKernelHandler).toBeDefined();
  });
});
