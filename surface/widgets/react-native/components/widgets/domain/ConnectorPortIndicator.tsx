import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';

export type PortDirection = 'in' | 'out' | 'bidirectional';
export type PortSide = 'top' | 'right' | 'bottom' | 'left' | 'center';

const DIRECTION_COLORS: Record<PortDirection, string> = {
  in: '#2196F3',
  out: '#FF9800',
  bidirectional: '#4CAF50',
};

export interface ConnectorPortIndicatorProps {
  portId: string;
  direction: PortDirection;
  portType?: string;
  label?: string;
  side: PortSide;
  offset?: number;
  connectionCount?: number;
  maxConnections?: number;
  style?: ViewStyle;
}

export const ConnectorPortIndicator: React.FC<ConnectorPortIndicatorProps> = ({
  portId, direction, label, side, offset = 0.5,
  connectionCount = 0, maxConnections, style,
}) => {
  const color = DIRECTION_COLORS[direction];
  const positionStyle = getPositionStyle(side, offset);

  return (
    <View
      style={[styles.root, positionStyle, style]}
      accessibilityRole="image"
      accessibilityLabel={`${direction} port${label ? `: ${label}` : ''} (${connectionCount}${maxConnections != null ? `/${maxConnections}` : ''} connections)`}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      {label != null && <Text style={styles.label}>{label}</Text>}
      {connectionCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {connectionCount}{maxConnections != null ? `/${maxConnections}` : ''}
          </Text>
        </View>
      )}
    </View>
  );
};

function getPositionStyle(side: PortSide, offset: number): ViewStyle {
  const pct = `${offset * 100}%` as unknown as number;
  switch (side) {
    case 'top': return { position: 'absolute', top: -6, left: pct, transform: [{ translateX: -6 }] };
    case 'bottom': return { position: 'absolute', bottom: -6, left: pct, transform: [{ translateX: -6 }] };
    case 'left': return { position: 'absolute', left: -6, top: pct, transform: [{ translateY: -6 }] };
    case 'right': return { position: 'absolute', right: -6, top: pct, transform: [{ translateY: -6 }] };
    case 'center': return { position: 'absolute', alignSelf: 'center' };
  }
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', zIndex: 10 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#fff' },
  label: { fontSize: 10, color: '#475569', marginLeft: 4 },
  badge: { backgroundColor: '#334155', borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 2 },
  badgeText: { fontSize: 9, color: '#fff', fontWeight: '600' },
});

ConnectorPortIndicator.displayName = 'ConnectorPortIndicator';
export default ConnectorPortIndicator;
