// ============================================================
// Clef Surface NativeScript Widget — Skeleton
//
// Loading placeholder skeleton with shimmer effect.
// ============================================================

import { StackLayout } from '@nativescript/core';

export interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: number | string;
  height?: number | string;
  lines?: number;
  animated?: boolean;
}

export function createSkeleton(props: SkeletonProps): StackLayout {
  const { variant = 'text', width, height, lines = 1, animated = true } = props;
  const container = new StackLayout();
  container.className = `clef-widget-skeleton clef-variant-${variant}`;
  container.accessibilityRole = 'none';
  container.accessibilityLabel = 'Loading';

  for (let i = 0; i < lines; i++) {
    const line = new StackLayout();
    line.className = 'clef-skeleton-line';
    line.backgroundColor = '#e0e0e0';
    if (width) line.width = width;
    if (height) line.height = height;
    else line.height = variant === 'text' ? 16 : 40;
    if (variant === 'circular') {
      line.borderRadius = '50%';
      line.width = line.height;
    }
    if (i < lines - 1) line.marginBottom = 8;
    container.addChild(line);
  }
  return container;
}

export default createSkeleton;
