import React, { type ReactNode } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';

// Props from icon.widget spec
export interface IconProps {
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  decorative?: boolean;
  label?: string;
  children?: ReactNode;
  style?: ViewStyle;
}

const sizeMap = { xs: 12, sm: 16, md: 20, lg: 28 };

export const Icon: React.FC<IconProps> = ({
  name = '',
  size = 'md',
  decorative = true,
  label,
  children,
  style,
}) => {
  const dimension = sizeMap[size];

  return (
    <View
      style={[styles.root, { width: dimension, height: dimension }, style]}
      accessibilityRole={decorative ? 'none' : 'image'}
      accessibilityLabel={decorative ? undefined : label}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
    >
      {children || <Text style={[styles.placeholder, { fontSize: dimension }]}>{'\u25CF'}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    color: '#64748b',
  },
});

Icon.displayName = 'Icon';
export default Icon;
