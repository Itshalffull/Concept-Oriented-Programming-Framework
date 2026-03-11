import React, { type ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Props from visually-hidden.widget spec
export interface VisuallyHiddenProps {
  text?: string;
  children?: ReactNode;
}

export const VisuallyHidden: React.FC<VisuallyHiddenProps> = ({
  text = '',
  children,
}) => {
  return (
    <View style={styles.root} accessibilityElementsHidden={false} importantForAccessibility="yes">
      <Text accessibilityRole="text">{children || text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
});

VisuallyHidden.displayName = 'VisuallyHidden';
export default VisuallyHidden;
