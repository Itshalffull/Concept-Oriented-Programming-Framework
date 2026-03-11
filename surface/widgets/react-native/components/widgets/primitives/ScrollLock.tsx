import React, { type ReactNode } from 'react';
import { View, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

// Props from scroll-lock.widget spec
// Note: In React Native, scroll locking is handled via ScrollView's
// scrollEnabled prop. This component wraps children and disables
// scroll when active.
export interface ScrollLockProps {
  active?: boolean;
  children?: ReactNode;
  style?: ViewStyle;
}

export const ScrollLock: React.FC<ScrollLockProps> = ({
  active = false,
  children,
  style,
}) => {
  return (
    <View
      style={[styles.root, style]}
      pointerEvents={active ? 'box-none' : 'auto'}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {},
});

ScrollLock.displayName = 'ScrollLock';
export default ScrollLock;
