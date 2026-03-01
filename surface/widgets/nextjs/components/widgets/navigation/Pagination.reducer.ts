// ---------------------------------------------------------------------------
// Pagination reducer — page navigation state and page-range computation.
// ---------------------------------------------------------------------------

export type PaginationState = { page: number };

export type PaginationAction =
  | { type: 'NAVIGATE_PREV' }
  | { type: 'NAVIGATE_NEXT'; totalPages: number }
  | { type: 'NAVIGATE_TO'; page: number; totalPages: number };

export function paginationReducer(state: PaginationState, action: PaginationAction): PaginationState {
  switch (action.type) {
    case 'NAVIGATE_PREV':
      return { page: Math.max(1, state.page - 1) };
    case 'NAVIGATE_NEXT':
      return { page: Math.min(action.totalPages, state.page + 1) };
    case 'NAVIGATE_TO':
      return { page: Math.max(1, Math.min(action.page, action.totalPages)) };
    default:
      return state;
  }
}

export function computePageRange(
  page: number,
  totalPages: number,
  siblingCount: number,
  boundaryCount: number,
): (number | 'ellipsis')[] {
  const result: (number | 'ellipsis')[] = [];
  const startBoundary = Array.from({ length: Math.min(boundaryCount, totalPages) }, (_, i) => i + 1);
  const endBoundary = Array.from(
    { length: Math.min(boundaryCount, totalPages) },
    (_, i) => totalPages - boundaryCount + 1 + i,
  ).filter((p) => p > boundaryCount);

  const siblingStart = Math.max(page - siblingCount, boundaryCount + 1);
  const siblingEnd = Math.min(page + siblingCount, totalPages - boundaryCount);

  const siblings: number[] = [];
  for (let i = siblingStart; i <= siblingEnd; i++) {
    if (i > 0 && i <= totalPages) siblings.push(i);
  }

  const all = new Set([...startBoundary, ...siblings, ...endBoundary]);
  const sorted = Array.from(all).sort((a, b) => a - b);

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push('ellipsis');
    }
    result.push(sorted[i]);
  }

  return result;
}
