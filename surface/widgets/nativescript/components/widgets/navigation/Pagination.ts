// ============================================================
// Clef Surface NativeScript Widget — Pagination
//
// Page navigation with previous/next and page numbers.
// ============================================================

import { StackLayout, Label, Button } from '@nativescript/core';

export interface PaginationProps {
  currentPage?: number;
  totalPages: number;
  siblingCount?: number;
  disabled?: boolean;
  onPageChange?: (page: number) => void;
  size?: 'sm' | 'md' | 'lg';
}

export function createPagination(props: PaginationProps): StackLayout {
  const { currentPage = 1, totalPages, siblingCount = 1, disabled = false, onPageChange, size = 'md' } = props;
  const container = new StackLayout();
  container.className = `clef-widget-pagination clef-size-${size}`;
  container.orientation = 'horizontal';
  container.accessibilityRole = 'navigation';
  container.accessibilityLabel = 'Pagination';

  const prevBtn = new Button();
  prevBtn.text = '\u2190';
  prevBtn.isEnabled = !disabled && currentPage > 1;
  prevBtn.accessibilityLabel = 'Previous page';
  prevBtn.on('tap', () => onPageChange?.(currentPage - 1));
  container.addChild(prevBtn);

  for (let i = 1; i <= totalPages; i++) {
    const pageBtn = new Button();
    pageBtn.text = String(i);
    pageBtn.className = i === currentPage ? 'clef-page-active' : 'clef-page';
    pageBtn.isEnabled = !disabled;
    pageBtn.accessibilityLabel = `Page ${i}`;
    pageBtn.on('tap', () => onPageChange?.(i));
    container.addChild(pageBtn);
  }

  const nextBtn = new Button();
  nextBtn.text = '\u2192';
  nextBtn.isEnabled = !disabled && currentPage < totalPages;
  nextBtn.accessibilityLabel = 'Next page';
  nextBtn.on('tap', () => onPageChange?.(currentPage + 1));
  container.addChild(nextBtn);

  return container;
}

export default createPagination;
