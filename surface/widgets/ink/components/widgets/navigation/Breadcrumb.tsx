// ============================================================
// Clef Surface Ink Widget — Breadcrumb
//
// Hierarchical location trail for terminal display.
// Renders a horizontal path like `Home > Products > Item`
// with dimColor for non-current items and bold for the
// current page. Maps breadcrumb.widget anatomy (root, list,
// item, link, separator, currentPage) to Ink Text.
// See Architecture doc Section 16.
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';

// --------------- Types ---------------

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

// --------------- Props ---------------

export interface BreadcrumbProps {
  /** Ordered breadcrumb trail items. */
  items: BreadcrumbItem[];
  /** Separator character between items. */
  separator?: string;
}

// --------------- Component ---------------

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  separator = '>',
}) => {
  if (items.length === 0) return null;

  return (
    <Box>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isCurrent = item.current ?? isLast;

        return (
          <Box key={`${item.label}-${index}`}>
            {isCurrent ? (
              <Text bold>{item.label}</Text>
            ) : (
              <Text dimColor>{item.label}</Text>
            )}
            {!isLast && (
              <Text dimColor> {separator} </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

Breadcrumb.displayName = 'Breadcrumb';
export default Breadcrumb;
