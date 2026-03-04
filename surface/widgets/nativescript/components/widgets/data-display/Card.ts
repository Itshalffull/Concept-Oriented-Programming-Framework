// ============================================================
// Clef Surface NativeScript Widget — Card
//
// Content card with header, body, footer, and media slots.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface CardProps {
  variant?: 'elevated' | 'filled' | 'outlined';
  clickable?: boolean;
  href?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  size?: 'sm' | 'md' | 'lg';
  title?: string;
  description?: string;
  onClick?: () => void;
  header?: View;
  media?: View;
  footer?: View;
  actions?: View;
  children?: View[];
}

export function createCard(props: CardProps): StackLayout {
  const {
    variant = 'elevated', clickable = false, href,
    padding = 'md', size = 'md', title, description,
    onClick, header, media, footer, actions, children = [],
  } = props;

  const container = new StackLayout();
  container.className = `clef-widget-card clef-variant-${variant} clef-size-${size}`;
  container.accessibilityRole = clickable ? 'button' : 'none';

  if (header) container.addChild(header);
  if (!header && title) {
    const headerContainer = new StackLayout();
    const titleLabel = new Label();
    titleLabel.text = title;
    titleLabel.fontWeight = 'bold';
    headerContainer.addChild(titleLabel);
    if (description) {
      const desc = new Label();
      desc.text = description;
      desc.opacity = 0.6;
      headerContainer.addChild(desc);
    }
    container.addChild(headerContainer);
  }
  if (media) container.addChild(media);

  const body = new StackLayout();
  body.className = 'clef-card-body';
  for (const child of children) body.addChild(child);
  container.addChild(body);

  if (footer || actions) {
    const footerContainer = new StackLayout();
    if (footer) footerContainer.addChild(footer);
    if (actions) footerContainer.addChild(actions);
    container.addChild(footerContainer);
  }

  if (clickable) {
    container.on('tap', () => onClick?.());
  }
  return container;
}

export default createCard;
