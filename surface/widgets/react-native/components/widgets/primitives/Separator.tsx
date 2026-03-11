import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';

// Props from separator.widget spec
export interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical';
  style?: ViewStyle;
}

export const Separator: React.FC<SeparatorProps> = ({
  orientation = 'horizontal',
  style,
}) => {
  const isHorizontal = orientation === 'horizontal';

  return (
    <View
      style={[
        isHorizontal ? styles.horizontal : styles.vertical,
        style,
      ]}
      accessibilityRole="none"
      accessibilityLabel="Separator"
    />
  );
};

const styles = StyleSheet.create({
  horizontal: {
    height: 1,
    backgroundColor: '#e2e8f0',
    alignSelf: 'stretch',
  },
  vertical: {
    width: 1,
    backgroundColor: '#e2e8f0',
    alignSelf: 'stretch',
  },
});

Separator.displayName = 'Separator';
export default Separator;
