import { describe, it, expect } from 'vitest';
import { scoreKernelHandler } from '../handlers/ts/score/score-kernel.handler.js';

describe('score-kernel', () => {
  it('loads', () => {
    expect(typeof scoreKernelHandler.boot).toBe('function');
  });
});
