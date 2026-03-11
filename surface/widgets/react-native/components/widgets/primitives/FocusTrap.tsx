import React, { type ReactNode } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';

// Props from focus-trap.widget spec
// Note: React Native does not have a native focus-trap mechanism like web.
// This component provides a structural container; actual focus trapping
// must be handled by the host application or a native module.
export interface FocusTrapProps {
  active?: boolean;
  returnFocus?: boolean;
  loop?: boolean;
  children?: ReactNode;
  style?: ViewStyle;
}

export const FocusTrap: React.FC<FocusTrapProps> = ({
  active = false,
  returnFocus = true,
  loop = true,
  children,
  style,
}) => {
  return (
    <View
      style={[styles.root, style]}
      accessibilityRole="none"
      accessibilityState={{ expanded: active }}
      accessibilityLabel={active ? 'Focus trap active' : undefined}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {},
});

FocusTrap.displayName = 'FocusTrap';
export default FocusTrap;
