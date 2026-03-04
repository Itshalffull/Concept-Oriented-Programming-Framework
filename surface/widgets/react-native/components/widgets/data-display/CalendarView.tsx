import React, { useState, useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  color?: string;
}

export interface CalendarViewProps {
  value?: string;
  defaultValue?: string;
  events?: CalendarEvent[];
  view?: 'month' | 'week' | 'day';
  locale?: string;
  minDate?: string;
  maxDate?: string;
  onDateSelect?: (date: string) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onViewChange?: (view: 'month' | 'week' | 'day') => void;
  children?: ReactNode;
  style?: ViewStyle;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  value,
  defaultValue,
  events = [],
  view = 'month',
  onDateSelect,
  onEventClick,
  onViewChange,
  children,
  style,
}) => {
  const [selectedDate, setSelectedDate] = useState(value || defaultValue || '');
  const [currentView, setCurrentView] = useState(view);

  const handleDateSelect = useCallback((date: string) => {
    setSelectedDate(date);
    onDateSelect?.(date);
  }, [onDateSelect]);

  const handleViewChange = useCallback((v: 'month' | 'week' | 'day') => {
    setCurrentView(v);
    onViewChange?.(v);
  }, [onViewChange]);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <View style={[styles.root, style]} accessibilityRole="none" accessibilityLabel="Calendar">
      <View style={styles.header}>
        <View style={styles.viewSwitcher}>
          {(['month', 'week', 'day'] as const).map((v) => (
            <Pressable key={v} onPress={() => handleViewChange(v)} style={[styles.viewBtn, currentView === v && styles.viewBtnActive]}>
              <Text style={[styles.viewBtnText, currentView === v && styles.viewBtnTextActive]}>{v}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.dayHeaders}>
        {dayNames.map((d) => (
          <Text key={d} style={styles.dayHeader}>{d}</Text>
        ))}
      </View>
      <View style={styles.grid}>
        {Array.from({ length: 35 }, (_, i) => {
          const day = (i % 31) + 1;
          const dateStr = String(day);
          const dayEvents = events.filter(e => e.date.endsWith('-' + String(day).padStart(2, '0')));
          return (
            <Pressable
              key={i}
              onPress={() => handleDateSelect(dateStr)}
              style={[styles.cell, selectedDate === dateStr && styles.cellSelected]}
              accessibilityRole="button"
              accessibilityLabel={"Day " + day}
            >
              <Text style={[styles.dayNum, selectedDate === dateStr && styles.dayNumSelected]}>{day}</Text>
              {dayEvents.map((ev) => (
                <Pressable key={ev.id} onPress={() => onEventClick?.(ev)}>
                  <Text style={[styles.event, { backgroundColor: ev.color || '#3b82f6' }]} numberOfLines={1}>{ev.title}</Text>
                </Pressable>
              ))}
            </Pressable>
          );
        })}
      </View>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 8, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'center', marginBottom: 8 },
  viewSwitcher: { flexDirection: 'row', gap: 4 },
  viewBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  viewBtnActive: { backgroundColor: '#3b82f6' },
  viewBtnText: { fontSize: 12, color: '#64748b', textTransform: 'capitalize' },
  viewBtnTextActive: { color: '#fff' },
  dayHeaders: { flexDirection: 'row' },
  dayHeader: { flex: 1, textAlign: 'center', fontSize: 11, color: '#94a3b8', fontWeight: '600', paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%' as any, minHeight: 48, padding: 2, borderWidth: 0.5, borderColor: '#f1f5f9' },
  cellSelected: { backgroundColor: '#eff6ff' },
  dayNum: { fontSize: 12, color: '#334155', textAlign: 'center' },
  dayNumSelected: { color: '#3b82f6', fontWeight: '700' },
  event: { fontSize: 9, color: '#fff', borderRadius: 2, paddingHorizontal: 2, marginTop: 1 },
});

CalendarView.displayName = 'CalendarView';
export default CalendarView;
