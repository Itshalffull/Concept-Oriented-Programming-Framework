// ============================================================
// Clef Surface NativeScript Widget — HoverCard
//
// Elevated card shown on hover (desktop) or long-press
// (mobile). Contains a rich content area with optional title,
// description, and a custom content builder. Positioned
// relative to a trigger area with configurable alignment.
// ============================================================

import { StackLayout, GridLayout, Label, Color, ContentView } from '@nativescript/core';

// --------------- Types ---------------

export type HoverCardAlignment = 'start' | 'center' | 'end';
export type HoverCardSide = 'top' | 'bottom' | 'left' | 'right';

// --------------- Props ---------------

export interface HoverCardProps {
  title?: string;
  description?: string;
  side?: HoverCardSide;
  alignment?: HoverCardAlignment;
  width?: number;
  visible?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
  elevation?: number;
  padding?: number;
  showArrow?: boolean;
  contentBuilder?: (parent: StackLayout) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

// --------------- Component ---------------

export function createHoverCard(props: HoverCardProps = {}): StackLayout {
  const {
    title,
    description,
    side = 'bottom',
    alignment = 'center',
    width = 280,
    visible = false,
    backgroundColor = '#FFFFFF',
    borderColor = '#E0E0E0',
    borderRadius = 12,
    elevation = 8,
    padding = 16,
    showArrow = true,
    contentBuilder,
    onOpen,
    onClose,
  } = props;

  // --- Wrapper handles visibility toggling ---
  const wrapper = new StackLayout();
  wrapper.className = `clef-hover-card clef-hover-card-${side}`;
  wrapper.visibility = visible ? 'visible' : 'collapse';

  // --- Arrow indicator ---
  if (showArrow) {
    const arrowContainer = new StackLayout();
    arrowContainer.className = 'clef-hover-card-arrow';
    arrowContainer.horizontalAlignment = alignment === 'start' ? 'left'
      : alignment === 'end' ? 'right'
      : 'center';

    const arrow = new ContentView();
    arrow.width = 12;
    arrow.height = 12;
    arrow.backgroundColor = backgroundColor as any;
    arrow.borderWidth = 1;
    arrow.borderColor = borderColor;
    arrow.rotate = 45;

    if (side === 'bottom') {
      arrow.marginTop = -6;
      arrowContainer.addChild(arrow);
      wrapper.addChild(arrowContainer);
    }
    // For top placement, arrow is appended after the card below
  }

  // --- Card ---
  const card = new StackLayout();
  card.className = 'clef-hover-card-body';
  card.width = width;
  card.backgroundColor = backgroundColor as any;
  card.borderRadius = borderRadius;
  card.borderWidth = 1;
  card.borderColor = borderColor;
  card.padding = padding;
  card.androidElevation = elevation;

  if (title) {
    const titleLabel = new Label();
    titleLabel.text = title;
    titleLabel.className = 'clef-hover-card-title';
    titleLabel.fontWeight = 'bold';
    titleLabel.fontSize = 15;
    titleLabel.color = new Color('#212121');
    titleLabel.textWrap = true;
    titleLabel.marginBottom = description || contentBuilder ? 6 : 0;
    card.addChild(titleLabel);
  }

  if (description) {
    const descLabel = new Label();
    descLabel.text = description;
    descLabel.className = 'clef-hover-card-description';
    descLabel.fontSize = 13;
    descLabel.color = new Color('#616161');
    descLabel.textWrap = true;
    descLabel.lineHeight = 1.4;
    descLabel.marginBottom = contentBuilder ? 8 : 0;
    card.addChild(descLabel);
  }

  if (contentBuilder) {
    const customContent = new StackLayout();
    customContent.className = 'clef-hover-card-custom';
    contentBuilder(customContent);
    card.addChild(customContent);
  }

  wrapper.addChild(card);

  // --- Arrow for top placement ---
  if (showArrow && side === 'top') {
    const arrowContainer = new StackLayout();
    arrowContainer.className = 'clef-hover-card-arrow';
    arrowContainer.horizontalAlignment = alignment === 'start' ? 'left'
      : alignment === 'end' ? 'right'
      : 'center';

    const arrow = new ContentView();
    arrow.width = 12;
    arrow.height = 12;
    arrow.backgroundColor = backgroundColor as any;
    arrow.borderWidth = 1;
    arrow.borderColor = borderColor;
    arrow.rotate = 45;
    arrow.marginBottom = -6;
    arrowContainer.addChild(arrow);
    wrapper.addChild(arrowContainer);
  }

  // --- Public toggle helpers attached to the view ---
  (wrapper as any).show = () => {
    wrapper.visibility = 'visible';
    if (onOpen) onOpen();
  };
  (wrapper as any).hide = () => {
    wrapper.visibility = 'collapse';
    if (onClose) onClose();
  };
  (wrapper as any).toggle = () => {
    const isVisible = wrapper.visibility === 'visible';
    wrapper.visibility = isVisible ? 'collapse' : 'visible';
    if (isVisible && onClose) onClose();
    if (!isVisible && onOpen) onOpen();
  };

  return wrapper;
}

createHoverCard.displayName = 'HoverCard';
export default createHoverCard;
