import { describe, expect, it } from 'vitest';
import { buildQuickCaptureNodeId, getEntityDisplayName } from '../quick-capture-identity';

describe('buildQuickCaptureNodeId', () => {
  it('derives a readable capture id from the entered title', () => {
    expect(buildQuickCaptureNodeId('Ship MAG-948 today')).toBe('capture:ship-mag-948-today');
  });

  it('normalizes punctuation and accented characters', () => {
    expect(buildQuickCaptureNodeId('  Café: polish / identity!  ')).toBe('capture:cafe-polish-identity');
  });

  it('falls back to a numbered suffix when retrying after a duplicate', () => {
    expect(buildQuickCaptureNodeId('Ship MAG-948 today', 2)).toBe('capture:ship-mag-948-today-3');
  });

  it('uses a stable untitled fallback when the title has no usable characters', () => {
    expect(buildQuickCaptureNodeId('!!!')).toBe('capture:untitled');
  });
});

describe('getEntityDisplayName', () => {
  it('prefers the stored title when available', () => {
    expect(getEntityDisplayName('capture:ship-mag-948-today', 'Ship MAG-948 today')).toEqual({
      title: 'Ship MAG-948 today',
      rawIdentity: 'capture:ship-mag-948-today',
      hasExplicitTitle: true,
    });
  });

  it('falls back to the raw identity when no title exists', () => {
    expect(getEntityDisplayName('workflow:editorial-pass', '')).toEqual({
      title: 'editorial-pass',
      rawIdentity: 'editorial-pass',
      hasExplicitTitle: false,
    });
  });
});
