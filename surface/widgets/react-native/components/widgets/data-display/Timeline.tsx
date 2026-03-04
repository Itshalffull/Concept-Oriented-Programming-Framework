import React, { type ReactNode } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';

export interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  timestamp?: string;
  icon?: ReactNode;
}

export interface TimelineProps {
  items: TimelineItem[];
  style?: ViewStyle;
}

export const Timeline: React.FC<TimelineProps> = ({
  items,
  style,
}) => (
  <View style={[styles.root, style]} accessibilityRole="list">
    {items.map((item, index) => (
      <View key={item.id} style={styles.item}>
        <View style={styles.indicator}>
          {item.icon ? <View style={styles.iconWrap}>{item.icon}</View> : <View style={styles.dot} />}
          {index < items.length - 1 && <View style={styles.line} />}
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>{item.title}</Text>
          {item.description && <Text style={styles.description}>{item.description}</Text>}
          {item.timestamp && <Text style={styles.timestamp}>{item.timestamp}</Text>}
        </View>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  root: {},
  item: { flexDirection: 'row', minHeight: 60 },
  indicator: { alignItems: 'center', width: 24, marginRight: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3b82f6' },
  iconWrap: {},
  line: { width: 2, flex: 1, backgroundColor: '#e2e8f0', marginTop: 4 },
  content: { flex: 1, paddingBottom: 20 },
  title: { fontSize: 14, fontWeight: '500', color: '#1e293b' },
  description: { fontSize: 13, color: '#475569', marginTop: 2 },
  timestamp: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
});

Timeline.displayName = 'Timeline';
export default Timeline;
