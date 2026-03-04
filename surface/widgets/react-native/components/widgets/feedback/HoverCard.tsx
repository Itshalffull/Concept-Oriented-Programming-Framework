import React, { useState, useCallback, useRef, type ReactNode } from 'react';
import { View, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface HoverCardProps {
  openDelay?: number;
  closeDelay?: number;
  content?: ReactNode;
  children: ReactNode;
  style?: ViewStyle;
}

export const HoverCard: React.FC<HoverCardProps> = ({
  openDelay = 700,
  closeDelay = 300,
  content,
  children,
  style,
}) => {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  const handleOpen = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => setVisible(true), openDelay);
  }, [openDelay, clearTimer]);

  const handleClose = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => setVisible(false), closeDelay);
  }, [closeDelay, clearTimer]);

  return (
    <View style={style}>
      <Pressable
        onPressIn={handleOpen}
        onPressOut={handleClose}
        accessibilityRole="button"
      >
        {children}
      </Pressable>
      {visible && content && (
        <View style={styles.card} accessibilityRole="summary">
          {content}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: '100%',
    left: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    zIndex: 999,
  },
});

HoverCard.displayName = 'HoverCard';
export default HoverCard;
