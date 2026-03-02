// ============================================================
// Clef Surface NativeScript Widget — Timeline
//
// Chronological event list with a vertical line connector,
// event dots, timestamps, and content. Supports multiple
// event types and custom colors per entry.
// ============================================================

import { StackLayout, GridLayout, Label, ContentView, Color } from '@nativescript/core';

// --------------- Types ---------------

export type TimelineEventType = 'default' | 'success' | 'warning' | 'error' | 'info';

export interface TimelineEvent {
  title: string;
  description?: string;
  timestamp?: string;
  type?: TimelineEventType;
  icon?: string;
  color?: string;
  onTap?: () => void;
}

// --------------- Props ---------------

export interface TimelineProps {
  events?: TimelineEvent[];
  lineColor?: string;
  lineWidth?: number;
  dotSize?: number;
  showTimestamps?: boolean;
  timestampPosition?: 'left' | 'inline';
  compact?: boolean;
}

// --------------- Constants ---------------

const EVENT_COLORS: Record<TimelineEventType, string> = {
  default: '#9E9E9E',
  success: '#388E3C',
  warning: '#F57C00',
  error: '#D32F2F',
  info: '#1976D2',
};

// --------------- Component ---------------

export function createTimeline(props: TimelineProps = {}): StackLayout {
  const {
    events = [],
    lineColor = '#E0E0E0',
    lineWidth = 2,
    dotSize = 12,
    showTimestamps = true,
    timestampPosition = 'inline',
    compact = false,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-timeline';
  container.padding = compact ? 8 : 16;

  if (events.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No events';
    emptyLabel.opacity = 0.5;
    emptyLabel.horizontalAlignment = 'center';
    emptyLabel.marginTop = 16;
    container.addChild(emptyLabel);
    return container;
  }

  events.forEach((event, index) => {
    const isLast = index === events.length - 1;
    const eventColor = event.color || EVENT_COLORS[event.type || 'default'];

    const useLeftTimestamp = showTimestamps && timestampPosition === 'left' && event.timestamp;

    const row = new GridLayout();
    row.className = 'clef-timeline-event';

    if (useLeftTimestamp) {
      row.columns = '60, auto, *';
    } else {
      row.columns = 'auto, *';
    }

    row.marginBottom = compact ? 4 : 12;

    // --- Left Timestamp ---
    if (useLeftTimestamp) {
      const tsLabel = new Label();
      tsLabel.text = event.timestamp!;
      tsLabel.className = 'clef-timeline-timestamp-left';
      tsLabel.fontSize = 11;
      tsLabel.opacity = 0.5;
      tsLabel.horizontalAlignment = 'right';
      tsLabel.verticalAlignment = 'top';
      tsLabel.marginRight = 8;
      tsLabel.marginTop = 2;
      GridLayout.setColumn(tsLabel, 0);
      row.addChild(tsLabel);
    }

    // --- Dot + Line column ---
    const dotCol = useLeftTimestamp ? 1 : 0;
    const dotLineContainer = new StackLayout();
    dotLineContainer.horizontalAlignment = 'center';
    dotLineContainer.width = dotSize + 8;

    // Dot
    const dot = new ContentView();
    dot.width = dotSize;
    dot.height = dotSize;
    dot.borderRadius = dotSize / 2;
    dot.backgroundColor = eventColor as any;
    dot.horizontalAlignment = 'center';

    if (event.icon) {
      const dotGrid = new GridLayout();
      dotGrid.width = dotSize + 4;
      dotGrid.height = dotSize + 4;
      dotGrid.borderRadius = (dotSize + 4) / 2;
      dotGrid.backgroundColor = eventColor as any;

      const iconLabel = new Label();
      iconLabel.text = event.icon;
      iconLabel.fontSize = dotSize * 0.6;
      iconLabel.color = new Color('#FFFFFF');
      iconLabel.horizontalAlignment = 'center';
      iconLabel.verticalAlignment = 'middle';
      dotGrid.addChild(iconLabel);
      dotLineContainer.addChild(dotGrid);
    } else {
      dotLineContainer.addChild(dot);
    }

    // Connecting line
    if (!isLast) {
      const line = new ContentView();
      line.width = lineWidth;
      line.height = compact ? 24 : 36;
      line.backgroundColor = lineColor as any;
      line.horizontalAlignment = 'center';
      dotLineContainer.addChild(line);
    }

    GridLayout.setColumn(dotLineContainer, dotCol);
    row.addChild(dotLineContainer);

    // --- Content column ---
    const contentCol = useLeftTimestamp ? 2 : 1;
    const contentStack = new StackLayout();
    contentStack.marginLeft = 10;
    contentStack.verticalAlignment = 'top';

    const titleLabel = new Label();
    titleLabel.text = event.title;
    titleLabel.className = 'clef-timeline-event-title';
    titleLabel.fontWeight = 'bold';
    titleLabel.fontSize = compact ? 13 : 14;
    titleLabel.textWrap = true;
    contentStack.addChild(titleLabel);

    if (event.description) {
      const descLabel = new Label();
      descLabel.text = event.description;
      descLabel.className = 'clef-timeline-event-desc';
      descLabel.fontSize = compact ? 12 : 13;
      descLabel.opacity = 0.7;
      descLabel.textWrap = true;
      descLabel.marginTop = 2;
      contentStack.addChild(descLabel);
    }

    if (showTimestamps && timestampPosition === 'inline' && event.timestamp) {
      const tsInline = new Label();
      tsInline.text = event.timestamp;
      tsInline.className = 'clef-timeline-event-timestamp';
      tsInline.fontSize = 11;
      tsInline.opacity = 0.4;
      tsInline.marginTop = 4;
      contentStack.addChild(tsInline);
    }

    if (event.onTap) {
      contentStack.on('tap', event.onTap);
    }

    GridLayout.setColumn(contentStack, contentCol);
    row.addChild(contentStack);

    container.addChild(row);
  });

  return container;
}

createTimeline.displayName = 'Timeline';
export default createTimeline;
