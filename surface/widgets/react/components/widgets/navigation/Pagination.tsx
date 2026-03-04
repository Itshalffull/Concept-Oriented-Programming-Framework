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


import {
  forwardRef,
  useReducer,
  useCallback,
  useMemo,
  type HTMLAttributes,
} from 'react';
import { paginationReducer, computePageRange } from './Pagination.reducer.js';

// ---------------------------------------------------------------------------
// Pagination — Page navigation with prev/next/numbered controls.
// Derived from pagination.widget spec.
// ---------------------------------------------------------------------------

export interface PaginationProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  page?: number;
  defaultPage?: number;
  totalPages: number;
  siblingCount?: number;
  boundaryCount?: number;
  disabled?: boolean;
  onPageChange?: (page: number) => void;
  variant?: string;
  size?: string;
}

export const Pagination = forwardRef<HTMLElement, PaginationProps>(
  function Pagination(
    {
      page: controlledPage,
      defaultPage = 1,
      totalPages,
      siblingCount = 1,
      boundaryCount = 1,
      disabled = false,
      onPageChange,
      variant,
      size,
      className,
      ...rest
    },
    ref
  ) {
    const isControlled = controlledPage !== undefined;
    const [internalState, dispatch] = useReducer(paginationReducer, {
      page: defaultPage,
    });

    const currentPage = isControlled ? controlledPage : internalState.page;
    const isAtFirst = currentPage <= 1;
    const isAtLast = currentPage >= totalPages;

    const pages = useMemo(
      () => computePageRange(currentPage, totalPages, siblingCount, boundaryCount),
      [currentPage, totalPages, siblingCount, boundaryCount]
    );

    const goToPage = useCallback(
      (target: number) => {
        if (disabled) return;
        if (!isControlled) {
          dispatch({ type: 'NAVIGATE_TO', page: target, totalPages });
        }
        onPageChange?.(target);
      },
      [disabled, isControlled, totalPages, onPageChange]
    );

    const handlePrev = useCallback(() => {
      if (isAtFirst || disabled) return;
      goToPage(currentPage - 1);
    }, [isAtFirst, disabled, currentPage, goToPage]);

    const handleNext = useCallback(() => {
      if (isAtLast || disabled) return;
      goToPage(currentPage + 1);
    }, [isAtLast, disabled, currentPage, goToPage]);

    let ellipsisKey = 0;

    return (
      <nav
        ref={ref}
        role="navigation"
        aria-label="Pagination"
        className={className}
        data-surface-widget=""
        data-widget-name="pagination"
        data-part="root"
        data-disabled={disabled ? 'true' : 'false'}
        data-variant={variant}
        data-size={size}
        {...rest}
      >
        <button
          type="button"
          aria-label="Previous page"
          aria-disabled={isAtFirst ? 'true' : 'false'}
          disabled={isAtFirst || disabled}
          data-part="prev-button"
          data-disabled={isAtFirst ? 'true' : 'false'}
          tabIndex={isAtFirst ? -1 : 0}
          onClick={handlePrev}
        >
          Previous
        </button>
        <span data-part="items">
          {pages.map((entry) => {
            if (entry === 'ellipsis') {
              ellipsisKey++;
              return (
                <span
                  key={`ellipsis-${ellipsisKey}`}
                  aria-hidden="true"
                  data-part="ellipsis"
                >
                  ...
                </span>
              );
            }
            const pageNum = entry;
            const isCurrent = pageNum === currentPage;
            return (
              <button
                key={pageNum}
                type="button"
                aria-label={`Page ${pageNum}`}
                aria-current={isCurrent ? 'page' : 'false'}
                data-part="item"
                data-selected={isCurrent ? 'true' : 'false'}
                tabIndex={0}
                onClick={() => goToPage(pageNum)}
                disabled={disabled}
              >
                {pageNum}
              </button>
            );
          })}
        </span>
        <button
          type="button"
          aria-label="Next page"
          aria-disabled={isAtLast ? 'true' : 'false'}
          disabled={isAtLast || disabled}
          data-part="next-button"
          data-disabled={isAtLast ? 'true' : 'false'}
          tabIndex={isAtLast ? -1 : 0}
          onClick={handleNext}
        >
          Next
        </button>
      </nav>
    );
  }
);

Pagination.displayName = 'Pagination';
export default Pagination;
