// ============================================================
// Clef Surface NativeScript Widget — Timeline
//
// Vertical timeline of events with status indicators.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';

export interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  timestamp?: string;
  status?: 'completed' | 'current' | 'upcoming';
  icon?: string;
}

export interface TimelineProps {
  items: TimelineItem[];
  orientation?: 'vertical' | 'horizontal';
}

export function createTimeline(props: TimelineProps): StackLayout {
  const { items, orientation = 'vertical' } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-timeline';

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const row = new StackLayout();
    row.orientation = 'horizontal';
    row.padding = '8 0';

    const indicator = new Label();
    indicator.text = item.status === 'completed' ? '\u2713' : item.status === 'current' ? '\u25CF' : '\u25CB';
    indicator.marginRight = 12;
    indicator.fontSize = 16;
    row.addChild(indicator);

    const content = new StackLayout();
    const title = new Label();
    title.text = item.title;
    title.fontWeight = item.status === 'current' ? 'bold' : 'normal';
    content.addChild(title);

    if (item.description) {
      const desc = new Label();
      desc.text = item.description;
      desc.opacity = 0.6;
      desc.fontSize = 12;
      desc.textWrap = true;
      content.addChild(desc);
    }
    if (item.timestamp) {
      const time = new Label();
      time.text = item.timestamp;
      time.opacity = 0.4;
      time.fontSize = 11;
      content.addChild(time);
    }
    row.addChild(content);
    container.addChild(row);
  }
  return container;
}

export default createTimeline;
