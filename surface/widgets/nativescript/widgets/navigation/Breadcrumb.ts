// ============================================================
// Clef Surface NativeScript Widget — Breadcrumb
//
// Breadcrumb navigation trail for NativeScript. Renders a
// horizontal row of tappable labels separated by configurable
// separator characters to show the current navigation path.
// ============================================================

import { StackLayout, FlexboxLayout, Label, Color } from '@nativescript/core';

// --------------- Types ---------------

export interface BreadcrumbItem {
  label: string;
  onTap?: () => void;
}

// --------------- Props ---------------

export interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  separator?: string;
  separatorColor?: string;
  activeColor?: string;
  inactiveColor?: string;
  fontSize?: number;
  padding?: number;
  gap?: number;
}

// --------------- Component ---------------

export function createBreadcrumb(props: BreadcrumbProps = {}): FlexboxLayout {
  const {
    items = [],
    separator = '/',
    separatorColor = '#9CA3AF',
    activeColor = '#111827',
    inactiveColor = '#6B7280',
    fontSize = 14,
    padding = 8,
    gap = 6,
  } = props;

  const container = new FlexboxLayout();
  container.className = 'clef-breadcrumb';
  container.flexDirection = 'row';
  container.alignItems = 'center';
  container.flexWrap = 'wrap';
  container.padding = padding;

  items.forEach((item, index) => {
    const isLast = index === items.length - 1;

    const crumbLabel = new Label();
    crumbLabel.text = item.label;
    crumbLabel.fontSize = fontSize;
    crumbLabel.color = new Color(isLast ? activeColor : inactiveColor);
    crumbLabel.fontWeight = isLast ? 'bold' : 'normal';
    crumbLabel.className = isLast ? 'clef-breadcrumb-active' : 'clef-breadcrumb-item';
    crumbLabel.marginRight = gap;

    if (!isLast && item.onTap) {
      crumbLabel.on('tap', item.onTap);
      crumbLabel.style.textDecoration = 'underline';
    }

    container.addChild(crumbLabel);

    if (!isLast) {
      const separatorLabel = new Label();
      separatorLabel.text = separator;
      separatorLabel.fontSize = fontSize;
      separatorLabel.color = new Color(separatorColor);
      separatorLabel.marginRight = gap;
      separatorLabel.className = 'clef-breadcrumb-separator';
      container.addChild(separatorLabel);
    }
  });

  return container;
}

createBreadcrumb.displayName = 'Breadcrumb';
export default createBreadcrumb;
