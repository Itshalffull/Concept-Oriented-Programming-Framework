import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface LayoutAlgorithm {
  name: string;
  label: string;
}

export type LayoutDirection = 'top-to-bottom' | 'left-to-right' | 'bottom-to-top' | 'right-to-left';

const DIRECTIONS: { value: LayoutDirection; label: string }[] = [
  { value: 'top-to-bottom', label: 'TB' },
  { value: 'left-to-right', label: 'LR' },
  { value: 'bottom-to-top', label: 'BT' },
  { value: 'right-to-left', label: 'RL' },
];

export interface LayoutControlPanelProps {
  algorithms?: LayoutAlgorithm[];
  selectedAlgorithm?: string;
  direction?: LayoutDirection;
  spacingX?: number;
  spacingY?: number;
  canvasId: string;
  onAlgorithmChange?: (algorithm: string) => void;
  onDirectionChange?: (direction: LayoutDirection) => void;
  onSpacingChange?: (spacingX: number, spacingY: number) => void;
  onApply?: (params: { algorithm: string; direction: LayoutDirection; spacingX: number; spacingY: number }) => void;
  style?: ViewStyle;
}

export const LayoutControlPanel: React.FC<LayoutControlPanelProps> = ({
  algorithms = [], selectedAlgorithm, direction = 'top-to-bottom',
  spacingX = 80, spacingY = 100, canvasId,
  onAlgorithmChange, onDirectionChange, onApply, style,
}) => {
  const [algo, setAlgo] = useState(selectedAlgorithm ?? algorithms[0]?.name ?? '');
  const [dir, setDir] = useState<LayoutDirection>(direction);
  const [spacing, setSpacing] = useState(spacingX);
  const [applying, setApplying] = useState(false);

  const handleApply = () => {
    if (!algo) return;
    setApplying(true);
    onApply?.({ algorithm: algo, direction: dir, spacingX: spacing, spacingY });
    setTimeout(() => setApplying(false), 300);
  };

  return (
    <View style={[styles.root, style]} accessibilityRole="summary" accessibilityLabel="Layout controls">
      <Text style={styles.sectionLabel}>Algorithm</Text>
      <View style={styles.chipRow}>
        {algorithms.map(a => (
          <Pressable
            key={a.name}
            style={[styles.chip, algo === a.name && styles.chipActive]}
            onPress={() => { setAlgo(a.name); onAlgorithmChange?.(a.name); }}
            accessibilityRole="button"
            accessibilityLabel={a.label}
          >
            <Text style={[styles.chipText, algo === a.name && styles.chipTextActive]}>{a.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Direction</Text>
      <View style={styles.chipRow}>
        {DIRECTIONS.map(d => (
          <Pressable
            key={d.value}
            style={[styles.chip, dir === d.value && styles.chipActive]}
            onPress={() => { setDir(d.value); onDirectionChange?.(d.value); }}
            accessibilityRole="button"
            accessibilityLabel={d.value}
          >
            <Text style={[styles.chipText, dir === d.value && styles.chipTextActive]}>{d.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Spacing: {spacing}</Text>
      <View style={styles.sliderRow}>
        <Pressable onPress={() => setSpacing(s => Math.max(20, s - 10))} style={styles.stepBtn}>
          <Text style={styles.stepBtnText}>-</Text>
        </Pressable>
        <View style={styles.sliderTrack}>
          <View style={[styles.sliderFill, { width: `${((spacing - 20) / 180) * 100}%` as unknown as number }]} />
        </View>
        <Pressable onPress={() => setSpacing(s => Math.min(200, s + 10))} style={styles.stepBtn}>
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.applyBtn, (!algo || applying) && styles.applyBtnDisabled]}
        onPress={handleApply}
        disabled={!algo || applying}
        accessibilityRole="button"
        accessibilityLabel="Apply layout"
      >
        <Text style={styles.applyBtnText}>{applying ? 'Applying...' : 'Apply Layout'}</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 14 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 6, marginTop: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  chipText: { fontSize: 12, fontWeight: '500', color: '#475569' },
  chipTextActive: { color: '#fff' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  stepBtn: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  stepBtnText: { fontSize: 16, fontWeight: '600', color: '#475569' },
  sliderTrack: { flex: 1, height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
  sliderFill: { height: 6, backgroundColor: '#3b82f6', borderRadius: 3 },
  applyBtn: { marginTop: 14, backgroundColor: '#3b82f6', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  applyBtnDisabled: { backgroundColor: '#94a3b8' },
  applyBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

LayoutControlPanel.displayName = 'LayoutControlPanel';
export default LayoutControlPanel;
