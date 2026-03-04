import React from 'react';
import { View, Animated, StyleSheet, type ViewStyle } from 'react-native';

export interface SkeletonProps {
  width?: number | string;
  height?: number;
  variant?: 'text' | 'circular' | 'rectangular';
  animate?: boolean;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  variant = 'text',
  animate = true,
  style,
}) => {
  const borderRadius = variant === 'circular' ? (typeof height === 'number' ? height / 2 : 50) : variant === 'text' ? 4 : 8;

  return (
    <View
      style={[
        styles.root,
        { width: width as any, height, borderRadius },
        style,
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    />
  );
};

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
});

Skeleton.displayName = 'Skeleton';
export default Skeleton;
