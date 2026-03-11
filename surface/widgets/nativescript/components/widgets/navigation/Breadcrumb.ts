// ============================================================
// Clef Surface NativeScript Widget — Breadcrumb
//
// Navigation breadcrumb trail showing page hierarchy.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';

export interface BreadcrumbItem { label: string; href?: string; }

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: string;
  onNavigate?: (href: string) => void;
}

export function createBreadcrumb(props: BreadcrumbProps): StackLayout {
  const { items, separator = '/', onNavigate } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-breadcrumb';
  container.orientation = 'horizontal';
  container.accessibilityRole = 'none';

  items.forEach((item, index) => {
    const link = new Label();
    link.text = item.label;
    link.className = index === items.length - 1 ? 'clef-breadcrumb-current' : 'clef-breadcrumb-link';
    if (item.href && index < items.length - 1) {
      link.on('tap', () => onNavigate?.(item.href!));
    }
    container.addChild(link);
    if (index < items.length - 1) {
      const sep = new Label();
      sep.text = ` ${separator} `;
      sep.opacity = 0.5;
      container.addChild(sep);
    }
  });
  return container;
}

export default createBreadcrumb;
