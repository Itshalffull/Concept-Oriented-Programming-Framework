/**
 * Pure logic for roving focus index calculations.
 * Extracted from useRovingFocus for testability.
 */

/** Compute the next index when navigating forward. */
export function getNextIndex(current: number, count: number, loop: boolean): number {
  if (count <= 0) return 0;
  return loop ? (current + 1) % count : Math.min(current + 1, count - 1);
}

/** Compute the previous index when navigating backward. */
export function getPrevIndex(current: number, count: number, loop: boolean): number {
  if (count <= 0) return 0;
  return loop ? (current - 1 + count) % count : Math.max(current - 1, 0);
}

/** Return the home (first) index. */
export function getHomeIndex(): number {
  return 0;
}

/** Return the end (last) index for a given count. */
export function getEndIndex(count: number): number {
  return count - 1;
}
