import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';

export type AnchorType = 'pin' | 'align_h' | 'align_v' | 'separate' | 'group_bounds' | 'flow_direction';

export interface ConstraintAnchorParameters {
  x?: number;
  y?: number;
  gap?: number;
  axis?: string;
  direction?: string;
}

export interface ConstraintAnchorIndicatorProps {
  anchorId: string;
  anchorType: AnchorType;
  targetItems?: string[];
  targetCount?: number;
  parameters?: ConstraintAnchorParameters;
  selected?: boolean;
  style?: ViewStyle;
}

export const ConstraintAnchorIndicator: React.FC<ConstraintAnchorIndicatorProps> = ({
  anchorId, anchorType, targetCount = 0, parameters, selected = false, style,
}) => (
  <View
    style={[styles.root, selected && styles.selected, style]}
    accessibilityRole="image"
    accessibilityLabel={`${anchorType} constraint on ${targetCount} items`}
  >
    {anchorType === 'pin' && (
      <View style={styles.pinContainer}>
        <View style={styles.pinIcon} />
        <Text style={styles.pinLabel}>Pinned</Text>
      </View>
    )}

    {(anchorType === 'align_h' || anchorType === 'align_v') && (
      <View style={[styles.alignmentLine, anchorType === 'align_h' ? styles.alignH : styles.alignV]} />
    )}

    {anchorType === 'separate' && (
      <View style={styles.separationContainer}>
        <Text style={styles.arrowText}>{'<-->'}</Text>
        {parameters?.gap != null && <Text style={styles.gapLabel}>{parameters.gap}px</Text>}
      </View>
    )}

    {anchorType === 'group_bounds' && (
      <View style={styles.groupBounds} />
    )}

    {anchorType === 'flow_direction' && (
      <View style={styles.flowArrow}>
        <Text style={styles.arrowText}>{parameters?.direction === 'horizontal' ? '-->' : 'v'}</Text>
      </View>
    )}
  </View>
);

const styles = StyleSheet.create({
  root: { position: 'absolute', zIndex: 5 },
  selected: { opacity: 1 },
  pinContainer: { alignItems: 'center' },
  pinIcon: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#ef4444', borderWidth: 2, borderColor: '#fff' },
  pinLabel: { fontSize: 9, color: '#ef4444', fontWeight: '600', marginTop: 2 },
  alignmentLine: { backgroundColor: '#8b5cf6', position: 'absolute' },
  alignH: { height: 1, width: '100%', top: '50%' },
  alignV: { width: 1, height: '100%', left: '50%' },
  separationContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  arrowText: { fontSize: 12, color: '#f59e0b', fontWeight: '700' },
  gapLabel: { fontSize: 10, color: '#f59e0b' },
  groupBounds: { borderWidth: 1, borderColor: '#06b6d4', borderStyle: 'dashed', borderRadius: 4, width: '100%', height: '100%', position: 'absolute' },
  flowArrow: { alignItems: 'center', justifyContent: 'center' },
});

ConstraintAnchorIndicator.displayName = 'ConstraintAnchorIndicator';
export default ConstraintAnchorIndicator;
