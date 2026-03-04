import React, { type ReactNode } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';

// Props from portal.widget spec
// Note: React Native does not have a DOM portal concept. This component
// renders children inline. For true portal behavior (rendering above other
// content), use React Native's Modal or a library like react-native-portal.
export interface PortalProps {
  disabled?: boolean;
  children?: ReactNode;
  style?: ViewStyle;
}

export const Portal: React.FC<PortalProps> = ({
  disabled = false,
  children,
  style,
}) => {
  return (
    <View style={[styles.root, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {},
});

Portal.displayName = 'Portal';
export default Portal;
