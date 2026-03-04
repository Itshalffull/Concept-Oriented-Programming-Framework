import React, { useState, useCallback, useRef, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface TooltipProps {
  label?: string;
  openDelay?: number;
  closeDelay?: number;
  children: ReactNode;
  style?: ViewStyle;
}

export const Tooltip: React.FC<TooltipProps> = ({
  label = '',
  openDelay = 700,
  closeDelay = 300,
  children,
  style,
}) => {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  const handleShow = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => setVisible(true), openDelay);
  }, [openDelay, clearTimer]);

  const handleHide = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => setVisible(false), closeDelay);
  }, [closeDelay, clearTimer]);

  return (
    <View style={style}>
      <Pressable
        onPressIn={handleShow}
        onPressOut={handleHide}
        accessibilityRole="button"
        accessibilityHint={label}
      >
        {children}
      </Pressable>
      {visible && label.length > 0 && (
        <View style={styles.tooltip} accessibilityRole="text">
          <Text style={styles.label}>{label}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  tooltip: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 4,
    zIndex: 999,
  },
  label: { fontSize: 12, color: '#fff' },
});

Tooltip.displayName = 'Tooltip';
export default Tooltip;
