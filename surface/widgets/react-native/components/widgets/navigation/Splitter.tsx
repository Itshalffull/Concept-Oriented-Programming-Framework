import React, { useState, useCallback, useRef, type ReactNode } from 'react';
import { View, PanResponder, StyleSheet, type ViewStyle, type LayoutChangeEvent } from 'react-native';

export interface SplitterProps {
  orientation?: 'horizontal' | 'vertical';
  defaultSize?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onSizeChange?: (size: number) => void;
  panelBefore?: ReactNode;
  panelAfter?: ReactNode;
  style?: ViewStyle;
}

export const Splitter: React.FC<SplitterProps> = ({
  orientation = 'horizontal',
  defaultSize = 50,
  min = 10,
  max = 90,
  disabled = false,
  onSizeChange,
  panelBefore,
  panelAfter,
  style,
}) => {
  const [size, setSize] = useState(defaultSize);
  const containerSize = useRef({ width: 0, height: 0 });

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    containerSize.current = { width, height };
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderMove: (_, gestureState) => {
        const total = orientation === 'horizontal' ? containerSize.current.width : containerSize.current.height;
        if (total === 0) return;
        const delta = orientation === 'horizontal' ? gestureState.dx : gestureState.dy;
        const ratio = ((defaultSize / 100) * total + delta) / total * 100;
        const clamped = Math.max(min, Math.min(max, ratio));
        setSize(Math.round(clamped * 100) / 100);
        onSizeChange?.(clamped);
      },
    })
  ).current;

  const isHorizontal = orientation === 'horizontal';

  return (
    <View
      style={[styles.root, isHorizontal ? styles.horizontal : styles.vertical, style]}
      onLayout={handleLayout}
      accessibilityRole="adjustable"
      accessibilityLabel="Resizable splitter"
    >
      <View style={[isHorizontal ? { width: `${size}%` } : { height: `${size}%` }, styles.panel]}>
        {panelBefore}
      </View>
      <View
        {...panResponder.panHandlers}
        style={[styles.handle, isHorizontal ? styles.handleH : styles.handleV, disabled && styles.disabled]}
        accessibilityRole="adjustable"
        accessibilityValue={{ min, max, now: Math.round(size) }}
      />
      <View style={[isHorizontal ? { width: `${100 - size}%` } : { height: `${100 - size}%` }, styles.panel]}>
        {panelAfter}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  horizontal: { flexDirection: 'row' },
  vertical: { flexDirection: 'column' },
  panel: { overflow: 'hidden' },
  handle: { backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
  handleH: { width: 6 },
  handleV: { height: 6 },
  disabled: { opacity: 0.4 },
});

Splitter.displayName = 'Splitter';
export default Splitter;
