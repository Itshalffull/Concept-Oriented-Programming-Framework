import React, { type ReactNode } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';

export interface FloatingToolbarProps {
  open?: boolean;
  placement?: string;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
  style?: ViewStyle;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  open = false,
  placement = 'top',
  children,
  style,
}) => {
  if (!open) return null;

  return (
    <View
      style={[styles.root, style]}
      accessibilityRole="toolbar"
      accessibilityLabel="Formatting toolbar"
    >
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 999,
  },
  content: { flexDirection: 'row', padding: 4 },
});

FloatingToolbar.displayName = 'FloatingToolbar';
export default FloatingToolbar;
