// ============================================================
// Clef Surface NativeScript Widget — Accordion
//
// Expandable accordion sections for NativeScript. Each section
// has a tappable header that reveals or hides its content panel.
// Only one section can be open at a time when exclusive mode
// is enabled.
// ============================================================

import { StackLayout, Label, GridLayout, Color } from '@nativescript/core';

// --------------- Types ---------------

export interface AccordionSection {
  title: string;
  content?: string;
  expanded?: boolean;
}

// --------------- Props ---------------

export interface AccordionProps {
  sections?: AccordionSection[];
  exclusive?: boolean;
  headerBackgroundColor?: string;
  headerTextColor?: string;
  contentBackgroundColor?: string;
  contentTextColor?: string;
  borderColor?: string;
  borderRadius?: number;
  padding?: number;
  gap?: number;
}

// --------------- Component ---------------

export function createAccordion(props: AccordionProps = {}): StackLayout {
  const {
    sections = [],
    exclusive = true,
    headerBackgroundColor = '#F3F4F6',
    headerTextColor = '#111827',
    contentBackgroundColor = '#FFFFFF',
    contentTextColor = '#374151',
    borderColor = '#E5E7EB',
    borderRadius = 8,
    padding = 12,
    gap = 4,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-accordion';
  container.padding = padding;

  const sectionViews: { header: GridLayout; content: StackLayout; expanded: boolean }[] = [];

  sections.forEach((section, index) => {
    const sectionContainer = new StackLayout();
    sectionContainer.className = 'clef-accordion-section';
    sectionContainer.marginBottom = index < sections.length - 1 ? gap : 0;
    sectionContainer.borderRadius = borderRadius;
    sectionContainer.borderWidth = 1;
    sectionContainer.borderColor = new Color(borderColor);

    // Header row
    const header = new GridLayout();
    header.className = 'clef-accordion-header';
    header.columns = '*, auto';
    header.padding = 12;
    header.backgroundColor = new Color(headerBackgroundColor);
    header.borderRadius = borderRadius;

    const titleLabel = new Label();
    titleLabel.text = section.title;
    titleLabel.color = new Color(headerTextColor);
    titleLabel.fontWeight = 'bold';
    titleLabel.fontSize = 15;
    GridLayout.setColumn(titleLabel, 0);
    header.addChild(titleLabel);

    const chevron = new Label();
    chevron.text = section.expanded ? '\u25B2' : '\u25BC';
    chevron.color = new Color(headerTextColor);
    chevron.fontSize = 12;
    chevron.horizontalAlignment = 'right';
    chevron.verticalAlignment = 'middle';
    GridLayout.setColumn(chevron, 1);
    header.addChild(chevron);

    sectionContainer.addChild(header);

    // Content panel
    const contentPanel = new StackLayout();
    contentPanel.className = 'clef-accordion-content';
    contentPanel.padding = 12;
    contentPanel.backgroundColor = new Color(contentBackgroundColor);
    contentPanel.visibility = section.expanded ? 'visible' : 'collapse';

    if (section.content) {
      const contentLabel = new Label();
      contentLabel.text = section.content;
      contentLabel.color = new Color(contentTextColor);
      contentLabel.fontSize = 14;
      contentLabel.textWrap = true;
      contentPanel.addChild(contentLabel);
    }

    sectionContainer.addChild(contentPanel);
    container.addChild(sectionContainer);

    const sectionState = { header, content: contentPanel, expanded: !!section.expanded };
    sectionViews.push(sectionState);

    // Toggle on tap
    header.on('tap', () => {
      if (exclusive) {
        sectionViews.forEach((sv, i) => {
          if (i !== index && sv.expanded) {
            sv.expanded = false;
            sv.content.visibility = 'collapse';
            const ch = sv.header.getChildAt(1) as Label;
            if (ch) ch.text = '\u25BC';
          }
        });
      }
      sectionState.expanded = !sectionState.expanded;
      contentPanel.visibility = sectionState.expanded ? 'visible' : 'collapse';
      chevron.text = sectionState.expanded ? '\u25B2' : '\u25BC';
    });
  });

  return container;
}

createAccordion.displayName = 'Accordion';
export default createAccordion;
