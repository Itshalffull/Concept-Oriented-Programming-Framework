// ============================================================
// Clef Surface NativeScript Widget — CalendarView
//
// Calendar grid with events, navigation, and date selection.
// ============================================================

import { StackLayout, GridLayout, Label, Button } from '@nativescript/core';

export interface CalendarEvent { id: string; title: string; date: string; color?: string; }

export interface CalendarViewProps {
  selectedDate?: string;
  events?: CalendarEvent[];
  view?: 'month' | 'week' | 'day';
  firstDayOfWeek?: number;
  minDate?: string;
  maxDate?: string;
  onDateSelect?: (date: string) => void;
  onNavigate?: (date: string) => void;
  onEventClick?: (id: string) => void;
}

export function createCalendarView(props: CalendarViewProps): StackLayout {
  const {
    selectedDate, events = [], view = 'month',
    firstDayOfWeek = 0, minDate, maxDate,
    onDateSelect, onNavigate, onEventClick,
  } = props;

  const container = new StackLayout();
  container.className = `clef-widget-calendar-view clef-view-${view}`;
  container.accessibilityRole = 'none';
  container.accessibilityLabel = 'Calendar';

  const header = new StackLayout();
  header.orientation = 'horizontal';
  const prevBtn = new Button();
  prevBtn.text = '\u2190';
  prevBtn.accessibilityLabel = 'Previous';
  prevBtn.on('tap', () => onNavigate?.('prev'));
  header.addChild(prevBtn);

  const titleLabel = new Label();
  titleLabel.text = selectedDate || 'Calendar';
  titleLabel.horizontalAlignment = 'center';
  header.addChild(titleLabel);

  const nextBtn = new Button();
  nextBtn.text = '\u2192';
  nextBtn.accessibilityLabel = 'Next';
  nextBtn.on('tap', () => onNavigate?.('next'));
  header.addChild(nextBtn);

  container.addChild(header);

  const grid = new StackLayout();
  grid.className = 'clef-calendar-grid';
  container.addChild(grid);

  return container;
}

export default createCalendarView;
