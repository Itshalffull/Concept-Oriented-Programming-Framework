import { describe, it, expect } from 'vitest';
import {
  getNextIndex,
  getPrevIndex,
  getHomeIndex,
  getEndIndex,
} from '../../surface/widgets/nextjs/components/widgets/shared/rovingFocusLogic.js';

describe('Roving Focus Pure Logic', () => {
  describe('getNextIndex', () => {
    it('wraps forward when loop=true', () => {
      // At index 4 of 5 items, next wraps to 0
      expect(getNextIndex(4, 5, true)).toBe(0);
    });

    it('advances forward normally when loop=true and not at end', () => {
      expect(getNextIndex(2, 5, true)).toBe(3);
    });

    it('clamps at end when loop=false', () => {
      // At index 4 of 5 items, next stays at 4
      expect(getNextIndex(4, 5, false)).toBe(4);
    });

    it('advances forward normally when loop=false and not at end', () => {
      expect(getNextIndex(2, 5, false)).toBe(3);
    });

    it('stays at 0 with count=1 and loop=true', () => {
      expect(getNextIndex(0, 1, true)).toBe(0);
    });

    it('stays at 0 with count=1 and loop=false', () => {
      expect(getNextIndex(0, 1, false)).toBe(0);
    });

    it('returns 0 when count=0', () => {
      expect(getNextIndex(0, 0, true)).toBe(0);
      expect(getNextIndex(0, 0, false)).toBe(0);
    });

    it('wraps from index 0 with count=2 and loop=true', () => {
      expect(getNextIndex(0, 2, true)).toBe(1);
      expect(getNextIndex(1, 2, true)).toBe(0);
    });
  });

  describe('getPrevIndex', () => {
    it('wraps backward when loop=true', () => {
      // At index 0 of 5 items, prev wraps to 4
      expect(getPrevIndex(0, 5, true)).toBe(4);
    });

    it('moves backward normally when loop=true and not at start', () => {
      expect(getPrevIndex(3, 5, true)).toBe(2);
    });

    it('clamps at 0 when loop=false', () => {
      // At index 0 of 5 items, prev stays at 0
      expect(getPrevIndex(0, 5, false)).toBe(0);
    });

    it('moves backward normally when loop=false and not at start', () => {
      expect(getPrevIndex(3, 5, false)).toBe(2);
    });

    it('stays at 0 with count=1 and loop=true', () => {
      expect(getPrevIndex(0, 1, true)).toBe(0);
    });

    it('stays at 0 with count=1 and loop=false', () => {
      expect(getPrevIndex(0, 1, false)).toBe(0);
    });

    it('returns 0 when count=0', () => {
      expect(getPrevIndex(0, 0, true)).toBe(0);
      expect(getPrevIndex(0, 0, false)).toBe(0);
    });

    it('wraps from index 1 with count=2 and loop=true', () => {
      expect(getPrevIndex(1, 2, true)).toBe(0);
      expect(getPrevIndex(0, 2, true)).toBe(1);
    });
  });

  describe('getHomeIndex', () => {
    it('always returns 0', () => {
      expect(getHomeIndex()).toBe(0);
    });
  });

  describe('getEndIndex', () => {
    it('returns count - 1', () => {
      expect(getEndIndex(5)).toBe(4);
    });

    it('returns 0 for count=1', () => {
      expect(getEndIndex(1)).toBe(0);
    });

    it('returns -1 for count=0', () => {
      expect(getEndIndex(0)).toBe(-1);
    });

    it('returns correct index for count=10', () => {
      expect(getEndIndex(10)).toBe(9);
    });
  });

  describe('boundary navigation sequences', () => {
    it('navigates a full loop forward through 3 items', () => {
      const count = 3;
      let idx = 0;
      idx = getNextIndex(idx, count, true); // 0 -> 1
      expect(idx).toBe(1);
      idx = getNextIndex(idx, count, true); // 1 -> 2
      expect(idx).toBe(2);
      idx = getNextIndex(idx, count, true); // 2 -> 0
      expect(idx).toBe(0);
    });

    it('navigates a full loop backward through 3 items', () => {
      const count = 3;
      let idx = 0;
      idx = getPrevIndex(idx, count, true); // 0 -> 2
      expect(idx).toBe(2);
      idx = getPrevIndex(idx, count, true); // 2 -> 1
      expect(idx).toBe(1);
      idx = getPrevIndex(idx, count, true); // 1 -> 0
      expect(idx).toBe(0);
    });

    it('clamps at boundaries without loop', () => {
      const count = 3;

      // Clamp at end
      let idx = 2;
      idx = getNextIndex(idx, count, false);
      expect(idx).toBe(2);
      idx = getNextIndex(idx, count, false);
      expect(idx).toBe(2);

      // Clamp at start
      idx = 0;
      idx = getPrevIndex(idx, count, false);
      expect(idx).toBe(0);
      idx = getPrevIndex(idx, count, false);
      expect(idx).toBe(0);
    });

    it('home and end work with any count', () => {
      expect(getHomeIndex()).toBe(0);
      expect(getEndIndex(1)).toBe(0);
      expect(getEndIndex(100)).toBe(99);
    });
  });
});
