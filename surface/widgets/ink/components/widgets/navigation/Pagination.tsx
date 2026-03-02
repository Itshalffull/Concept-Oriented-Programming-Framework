// ============================================================
// Clef Surface Ink Widget — Pagination
//
// Page navigation control for terminal display.
// Renders numbered page links with ellipsis for large ranges,
// plus previous/next buttons. Displays as
// `< 1 2 [3] 4 5 ... 10 >` with arrow key navigation.
// Maps pagination.widget anatomy (root, prevButton, nextButton,
// items, item, ellipsis) to Ink Box/Text.
// See Architecture doc Section 16.
// ============================================================

import React, { useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface PaginationProps {
  /** Current page (1-indexed). */
  page: number;
  /** Total number of pages. */
  totalPages: number;
  /** Number of sibling pages to show around the current page. */
  siblingCount?: number;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when the page changes. */
  onChange?: (page: number) => void;
}

// --------------- Helpers ---------------

function buildPageRange(page: number, totalPages: number, siblingCount: number): (number | 'ellipsis')[] {
  const result: (number | 'ellipsis')[] = [];

  // Always show page 1
  result.push(1);

  const rangeStart = Math.max(2, page - siblingCount);
  const rangeEnd = Math.min(totalPages - 1, page + siblingCount);

  if (rangeStart > 2) {
    result.push('ellipsis');
  }

  for (let i = rangeStart; i <= rangeEnd; i++) {
    result.push(i);
  }

  if (rangeEnd < totalPages - 1) {
    result.push('ellipsis');
  }

  // Always show last page if more than 1
  if (totalPages > 1) {
    result.push(totalPages);
  }

  return result;
}

// --------------- Component ---------------

export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  siblingCount = 1,
  isFocused = false,
  onChange,
}) => {
  const pages = useMemo(
    () => buildPageRange(page, totalPages, siblingCount),
    [page, totalPages, siblingCount],
  );

  const goTo = useCallback(
    (target: number) => {
      if (target >= 1 && target <= totalPages && target !== page) {
        onChange?.(target);
      }
    },
    [page, totalPages, onChange],
  );

  useInput(
    (_input, key) => {
      if (!isFocused) return;

      if (key.leftArrow) {
        goTo(page - 1);
      } else if (key.rightArrow) {
        goTo(page + 1);
      }
    },
    { isActive: isFocused },
  );

  const atFirst = page <= 1;
  const atLast = page >= totalPages;

  return (
    <Box>
      {/* Previous button */}
      <Text color={atFirst ? 'gray' : isFocused ? 'cyan' : undefined} dimColor={atFirst}>
        {'\u25C4'}{' '}
      </Text>

      {/* Page items */}
      {pages.map((entry, index) => {
        if (entry === 'ellipsis') {
          return (
            <Text key={`ellipsis-${index}`} dimColor>
              {'... '}
            </Text>
          );
        }
        const isCurrent = entry === page;
        return (
          <Text
            key={entry}
            bold={isCurrent}
            color={isCurrent ? 'cyan' : undefined}
            inverse={isCurrent}
          >
            {isCurrent ? `[${entry}]` : String(entry)}{' '}
          </Text>
        );
      })}

      {/* Next button */}
      <Text color={atLast ? 'gray' : isFocused ? 'cyan' : undefined} dimColor={atLast}>
        {'\u25BA'}
      </Text>
    </Box>
  );
};

Pagination.displayName = 'Pagination';
export default Pagination;
