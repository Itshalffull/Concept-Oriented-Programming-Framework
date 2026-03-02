// ============================================================
// Clef Surface NativeScript Widget — Skeleton
//
// Loading placeholder skeleton that mimics content layout while
// data loads. Supports text lines, circular avatars, rectangular
// blocks, and composite card skeletons.
// ============================================================

import { StackLayout, GridLayout, ContentView, Color } from '@nativescript/core';

// --------------- Types ---------------

export type SkeletonVariant = 'text' | 'circular' | 'rectangular' | 'card';

// --------------- Props ---------------

export interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: number | string;
  height?: number;
  lines?: number;
  lineHeight?: number;
  lineSpacing?: number;
  borderRadius?: number;
  color?: string;
  animated?: boolean;
  avatarSize?: number;
  showAvatar?: boolean;
  showActions?: boolean;
}

// --------------- Helpers ---------------

function createSkeletonBlock(
  w: number | string,
  h: number,
  radius: number,
  color: string,
  animated: boolean,
): ContentView {
  const block = new ContentView();
  block.className = 'clef-skeleton-block';
  if (typeof w === 'number') {
    block.width = w;
  }
  block.height = h;
  block.borderRadius = radius;
  block.backgroundColor = color as any;
  block.opacity = animated ? 0.6 : 0.8;
  return block;
}

// --------------- Component ---------------

export function createSkeleton(props: SkeletonProps = {}): StackLayout {
  const {
    variant = 'text',
    width = '100%',
    height = 16,
    lines = 3,
    lineHeight = 14,
    lineSpacing = 8,
    borderRadius = 4,
    color = '#E0E0E0',
    animated = true,
    avatarSize = 40,
    showAvatar = false,
    showActions = false,
  } = props;

  const container = new StackLayout();
  container.className = `clef-skeleton clef-skeleton-${variant}`;

  switch (variant) {
    case 'text': {
      // Multiple text lines with varying widths
      const LINE_WIDTHS = [1, 1, 0.75, 0.9, 0.6];

      for (let i = 0; i < lines; i++) {
        const widthFactor = LINE_WIDTHS[i % LINE_WIDTHS.length];
        const lineBlock = createSkeletonBlock(
          typeof width === 'number' ? width * widthFactor : '100%',
          lineHeight,
          borderRadius,
          color,
          animated,
        );
        if (typeof width === 'string' && widthFactor < 1) {
          lineBlock.horizontalAlignment = 'left';
          lineBlock.width = `${widthFactor * 100}%` as any;
        }
        lineBlock.marginBottom = i < lines - 1 ? lineSpacing : 0;
        container.addChild(lineBlock);
      }
      break;
    }

    case 'circular': {
      const circle = createSkeletonBlock(
        avatarSize,
        avatarSize,
        avatarSize / 2,
        color,
        animated,
      );
      circle.horizontalAlignment = 'center';
      container.addChild(circle);
      break;
    }

    case 'rectangular': {
      const rect = createSkeletonBlock(
        width as number,
        height,
        borderRadius,
        color,
        animated,
      );
      container.addChild(rect);
      break;
    }

    case 'card': {
      container.padding = 16;
      container.borderRadius = 12;
      container.backgroundColor = '#FFFFFF' as any;
      container.androidElevation = 2;

      // Optional avatar + header row
      if (showAvatar) {
        const headerRow = new GridLayout();
        headerRow.columns = 'auto, *';
        headerRow.marginBottom = 16;

        const avatarBlock = createSkeletonBlock(
          avatarSize,
          avatarSize,
          avatarSize / 2,
          color,
          animated,
        );
        avatarBlock.verticalAlignment = 'middle';
        GridLayout.setColumn(avatarBlock, 0);
        headerRow.addChild(avatarBlock);

        const headerText = new StackLayout();
        headerText.verticalAlignment = 'middle';
        headerText.marginLeft = 12;

        const nameBlock = createSkeletonBlock('70%' as any, 14, borderRadius, color, animated);
        nameBlock.marginBottom = 6;
        headerText.addChild(nameBlock);

        const subBlock = createSkeletonBlock('50%' as any, 12, borderRadius, color, animated);
        headerText.addChild(subBlock);

        GridLayout.setColumn(headerText, 1);
        headerRow.addChild(headerText);

        container.addChild(headerRow);
      }

      // Image placeholder
      const imagePlaceholder = createSkeletonBlock('100%' as any, 140, 8, color, animated);
      imagePlaceholder.marginBottom = 16;
      container.addChild(imagePlaceholder);

      // Text lines
      for (let i = 0; i < 3; i++) {
        const textWidths = ['100%', '100%', '60%'];
        const line = createSkeletonBlock(textWidths[i] as any, lineHeight, borderRadius, color, animated);
        line.marginBottom = i < 2 ? lineSpacing : 0;
        container.addChild(line);
      }

      // Action buttons
      if (showActions) {
        const actionRow = new GridLayout();
        actionRow.columns = 'auto, auto, *';
        actionRow.marginTop = 16;

        const btn1 = createSkeletonBlock(64, 28, 14, color, animated);
        GridLayout.setColumn(btn1, 0);
        actionRow.addChild(btn1);

        const btn2 = createSkeletonBlock(64, 28, 14, color, animated);
        btn2.marginLeft = 8;
        GridLayout.setColumn(btn2, 1);
        actionRow.addChild(btn2);

        container.addChild(actionRow);
      }
      break;
    }
  }

  return container;
}

createSkeleton.displayName = 'Skeleton';
export default createSkeleton;
