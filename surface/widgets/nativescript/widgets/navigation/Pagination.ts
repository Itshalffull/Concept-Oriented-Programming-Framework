// ============================================================
// Clef Surface NativeScript Widget — Pagination
//
// Page navigation controls for NativeScript. Renders previous/
// next buttons, numbered page buttons, and an optional page
// info label. Supports configurable page range display and
// ellipsis for large page counts.
// ============================================================

import {
  StackLayout,
  FlexboxLayout,
  Label,
  Button,
  Color,
} from '@nativescript/core';

// --------------- Props ---------------

export interface PaginationProps {
  currentPage?: number;
  totalPages?: number;
  visiblePageCount?: number;
  showInfo?: boolean;
  previousLabel?: string;
  nextLabel?: string;
  onPageChange?: (page: number) => void;
  backgroundColor?: string;
  textColor?: string;
  activeTextColor?: string;
  activeBackgroundColor?: string;
  disabledColor?: string;
  borderColor?: string;
  borderRadius?: number;
  padding?: number;
  gap?: number;
}

// --------------- Helpers ---------------

function buildPageRange(current: number, total: number, visible: number): (number | '...')[] {
  if (total <= visible) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const half = Math.floor(visible / 2);
  let start = Math.max(1, current - half);
  let end = Math.min(total, start + visible - 1);

  if (end - start + 1 < visible) {
    start = Math.max(1, end - visible + 1);
  }

  const pages: (number | '...')[] = [];

  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push('...');
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (end < total) {
    if (end < total - 1) pages.push('...');
    pages.push(total);
  }

  return pages;
}

// --------------- Component ---------------

export function createPagination(props: PaginationProps = {}): FlexboxLayout {
  const {
    currentPage = 1,
    totalPages = 1,
    visiblePageCount = 5,
    showInfo = true,
    previousLabel = '\u2190 Prev',
    nextLabel = 'Next \u2192',
    onPageChange,
    backgroundColor = '#FFFFFF',
    textColor = '#374151',
    activeTextColor = '#FFFFFF',
    activeBackgroundColor = '#2563EB',
    disabledColor = '#D1D5DB',
    borderColor = '#E5E7EB',
    borderRadius = 6,
    padding = 8,
    gap = 4,
  } = props;

  const container = new FlexboxLayout();
  container.className = 'clef-pagination';
  container.flexDirection = 'row';
  container.alignItems = 'center';
  container.justifyContent = 'center';
  container.padding = padding;

  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  // Previous button
  const prevButton = new Button();
  prevButton.text = previousLabel;
  prevButton.className = 'clef-pagination-prev';
  prevButton.fontSize = 13;
  prevButton.borderRadius = borderRadius;
  prevButton.padding = '6 12';
  prevButton.marginRight = gap;
  prevButton.backgroundColor = new Color('transparent');
  prevButton.color = new Color(isFirstPage ? disabledColor : textColor);
  prevButton.borderWidth = 1;
  prevButton.borderColor = new Color(borderColor);
  prevButton.isEnabled = !isFirstPage;

  if (onPageChange && !isFirstPage) {
    prevButton.on('tap', () => onPageChange(currentPage - 1));
  }
  container.addChild(prevButton);

  // Page number buttons
  const pages = buildPageRange(currentPage, totalPages, visiblePageCount);

  pages.forEach((page) => {
    const pageButton = new Label();
    pageButton.fontSize = 13;
    pageButton.borderRadius = borderRadius;
    pageButton.padding = '6 10';
    pageButton.marginRight = gap;
    pageButton.horizontalAlignment = 'center';
    pageButton.textAlignment = 'center';
    pageButton.width = 36;
    pageButton.height = 36;
    pageButton.verticalAlignment = 'middle';

    if (page === '...') {
      pageButton.text = '\u2026';
      pageButton.className = 'clef-pagination-ellipsis';
      pageButton.color = new Color(textColor);
      pageButton.backgroundColor = new Color('transparent');
    } else {
      const isActive = page === currentPage;
      pageButton.text = String(page);
      pageButton.className = isActive ? 'clef-pagination-page clef-pagination-page-active' : 'clef-pagination-page';
      pageButton.color = new Color(isActive ? activeTextColor : textColor);
      pageButton.backgroundColor = new Color(isActive ? activeBackgroundColor : 'transparent');
      pageButton.fontWeight = isActive ? 'bold' : 'normal';
      pageButton.borderWidth = isActive ? 0 : 1;
      pageButton.borderColor = new Color(borderColor);

      if (onPageChange && !isActive) {
        pageButton.on('tap', () => onPageChange(page as number));
      }
    }

    container.addChild(pageButton);
  });

  // Next button
  const nextButton = new Button();
  nextButton.text = nextLabel;
  nextButton.className = 'clef-pagination-next';
  nextButton.fontSize = 13;
  nextButton.borderRadius = borderRadius;
  nextButton.padding = '6 12';
  nextButton.backgroundColor = new Color('transparent');
  nextButton.color = new Color(isLastPage ? disabledColor : textColor);
  nextButton.borderWidth = 1;
  nextButton.borderColor = new Color(borderColor);
  nextButton.isEnabled = !isLastPage;

  if (onPageChange && !isLastPage) {
    nextButton.on('tap', () => onPageChange(currentPage + 1));
  }
  container.addChild(nextButton);

  // Page info
  if (showInfo) {
    const infoLabel = new Label();
    infoLabel.text = `Page ${currentPage} of ${totalPages}`;
    infoLabel.className = 'clef-pagination-info';
    infoLabel.fontSize = 12;
    infoLabel.color = new Color(textColor);
    infoLabel.marginLeft = 12;
    infoLabel.verticalAlignment = 'middle';
    container.addChild(infoLabel);
  }

  return container;
}

createPagination.displayName = 'Pagination';
export default createPagination;
