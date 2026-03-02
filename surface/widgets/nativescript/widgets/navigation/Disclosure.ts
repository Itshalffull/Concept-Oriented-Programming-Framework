// ============================================================
// Clef Surface NativeScript Widget — Disclosure
//
// Collapsible content section for NativeScript. Renders a
// tappable summary row that toggles visibility of a content
// panel below it, with an animated disclosure indicator.
// ============================================================

import { StackLayout, GridLayout, Label, Color } from '@nativescript/core';

// --------------- Props ---------------

export interface DisclosureProps {
  title?: string;
  content?: string;
  expanded?: boolean;
  headerBackgroundColor?: string;
  headerTextColor?: string;
  contentBackgroundColor?: string;
  contentTextColor?: string;
  borderColor?: string;
  borderRadius?: number;
  padding?: number;
  fontSize?: number;
}

// --------------- Component ---------------

export function createDisclosure(props: DisclosureProps = {}): StackLayout {
  const {
    title = 'Details',
    content = '',
    expanded = false,
    headerBackgroundColor = '#F9FAFB',
    headerTextColor = '#111827',
    contentBackgroundColor = '#FFFFFF',
    contentTextColor = '#374151',
    borderColor = '#E5E7EB',
    borderRadius = 8,
    padding = 12,
    fontSize = 14,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-disclosure';
  container.borderRadius = borderRadius;
  container.borderWidth = 1;
  container.borderColor = new Color(borderColor);

  let isExpanded = expanded;

  // Summary header
  const header = new GridLayout();
  header.className = 'clef-disclosure-header';
  header.columns = 'auto, *';
  header.padding = padding;
  header.backgroundColor = new Color(headerBackgroundColor);

  const indicator = new Label();
  indicator.text = isExpanded ? '\u25BC' : '\u25B6';
  indicator.color = new Color(headerTextColor);
  indicator.fontSize = 12;
  indicator.marginRight = 8;
  indicator.verticalAlignment = 'middle';
  GridLayout.setColumn(indicator, 0);
  header.addChild(indicator);

  const titleLabel = new Label();
  titleLabel.text = title;
  titleLabel.color = new Color(headerTextColor);
  titleLabel.fontWeight = 'bold';
  titleLabel.fontSize = fontSize;
  titleLabel.verticalAlignment = 'middle';
  GridLayout.setColumn(titleLabel, 1);
  header.addChild(titleLabel);

  container.addChild(header);

  // Content panel
  const contentPanel = new StackLayout();
  contentPanel.className = 'clef-disclosure-content';
  contentPanel.padding = padding;
  contentPanel.backgroundColor = new Color(contentBackgroundColor);
  contentPanel.visibility = isExpanded ? 'visible' : 'collapse';

  if (content) {
    const contentLabel = new Label();
    contentLabel.text = content;
    contentLabel.color = new Color(contentTextColor);
    contentLabel.fontSize = fontSize;
    contentLabel.textWrap = true;
    contentPanel.addChild(contentLabel);
  }

  container.addChild(contentPanel);

  // Toggle behavior
  header.on('tap', () => {
    isExpanded = !isExpanded;
    contentPanel.visibility = isExpanded ? 'visible' : 'collapse';
    indicator.text = isExpanded ? '\u25BC' : '\u25B6';
  });

  return container;
}

createDisclosure.displayName = 'Disclosure';
export default createDisclosure;
