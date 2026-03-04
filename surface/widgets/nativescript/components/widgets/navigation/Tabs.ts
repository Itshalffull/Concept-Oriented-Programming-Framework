// ============================================================
// Clef Surface NativeScript Widget — Tabs
//
// Tab list with panels and keyboard navigation.
// ============================================================

import { StackLayout, Label, Button } from '@nativescript/core';

export interface TabItem {
  value: string;
  trigger: string;
  content: string;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  orientation?: 'horizontal' | 'vertical';
  activationMode?: 'automatic' | 'manual';
  disabled?: boolean;
  loop?: boolean;
  onValueChange?: (value: string) => void;
  variant?: string;
  size?: string;
}

export function createTabs(props: TabsProps): StackLayout {
  const {
    items, value, defaultValue, orientation = 'horizontal',
    activationMode = 'automatic', disabled = false,
    loop = true, onValueChange, variant, size,
  } = props;

  let activeValue = value ?? defaultValue ?? (items[0]?.value ?? '');
  const container = new StackLayout();
  container.className = 'clef-widget-tabs';

  const tabList = new StackLayout();
  tabList.orientation = orientation === 'horizontal' ? 'horizontal' : 'vertical';
  tabList.accessibilityRole = 'tablist';

  const panelContainer = new StackLayout();

  for (const item of items) {
    const tab = new Button();
    tab.text = item.trigger;
    tab.className = item.value === activeValue ? 'clef-tab-active' : 'clef-tab-inactive';
    tab.isEnabled = !disabled && !item.disabled;
    tab.accessibilityRole = 'tab';
    tab.accessibilityState = { selected: item.value === activeValue };

    tab.on('tap', () => {
      if (disabled || item.disabled) return;
      activeValue = item.value;
      onValueChange?.(item.value);
    });
    tabList.addChild(tab);
  }
  container.addChild(tabList);

  for (const item of items) {
    const panel = new StackLayout();
    panel.visibility = item.value === activeValue ? 'visible' : 'collapsed';
    panel.accessibilityRole = 'tabpanel';
    const contentLabel = new Label();
    contentLabel.text = item.content;
    contentLabel.textWrap = true;
    panel.addChild(contentLabel);
    panelContainer.addChild(panel);
  }
  container.addChild(panelContainer);

  return container;
}

export default createTabs;
