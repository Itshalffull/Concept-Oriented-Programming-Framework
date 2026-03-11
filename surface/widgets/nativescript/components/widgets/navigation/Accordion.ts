// ============================================================
// Clef Surface NativeScript Widget — Accordion
//
// Vertically stacked collapsible sections with expand/collapse.
// ============================================================

import { StackLayout, Label, Button } from '@nativescript/core';

export interface AccordionItem {
  value: string;
  trigger: string;
  content: string;
  disabled?: boolean;
}

export interface AccordionProps {
  items: AccordionItem[];
  value?: string[];
  defaultValue?: string[];
  multiple?: boolean;
  collapsible?: boolean;
  disabled?: boolean;
  onValueChange?: (value: string[]) => void;
  variant?: string;
  size?: string;
}

export function createAccordion(props: AccordionProps): StackLayout {
  const {
    items, value, defaultValue = [], multiple = false,
    collapsible = true, disabled = false, onValueChange,
    variant, size,
  } = props;

  let expandedItems = value ?? [...defaultValue];
  const container = new StackLayout();
  container.className = 'clef-widget-accordion';

  for (const item of items) {
    const section = new StackLayout();
    section.className = 'clef-accordion-item';
    const isExpanded = expandedItems.includes(item.value);
    const isDisabled = disabled || !!item.disabled;

    const trigger = new Button();
    trigger.text = `${isExpanded ? '\u25BC' : '\u25B6'} ${item.trigger}`;
    trigger.isEnabled = !isDisabled;
    trigger.accessibilityRole = 'button';
    trigger.accessibilityState = { expanded: isExpanded };

    const content = new StackLayout();
    content.visibility = isExpanded ? 'visible' : 'collapsed';
    content.padding = '8 16';
    const contentLabel = new Label();
    contentLabel.text = item.content;
    contentLabel.textWrap = true;
    content.addChild(contentLabel);

    trigger.on('tap', () => {
      if (isDisabled) return;
      const wasExpanded = expandedItems.includes(item.value);
      if (wasExpanded) {
        if (!collapsible && expandedItems.length === 1) return;
        expandedItems = expandedItems.filter((v: string) => v !== item.value);
      } else {
        expandedItems = multiple ? [...expandedItems, item.value] : [item.value];
      }
      onValueChange?.(expandedItems);
    });

    section.addChild(trigger);
    section.addChild(content);
    container.addChild(section);
  }
  return container;
}

export default createAccordion;
