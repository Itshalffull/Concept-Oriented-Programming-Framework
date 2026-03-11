import React, { type ReactNode } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';

export interface CardGridProps {
  columns?: number;
  gap?: number;
  children?: ReactNode;
  style?: ViewStyle;
}

export const CardGrid: React.FC<CardGridProps> = ({
  columns = 2,
  gap = 12,
  children,
  style,
}) => (
  <View style={[styles.root, { gap }, style]}>
    {React.Children.map(children, (child) => (
      <View style={{ width: `${100 / columns - 2}%`, marginBottom: gap }}>{child}</View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  root: { flexDirection: 'row', flexWrap: 'wrap' },
});

CardGrid.displayName = 'CardGrid';
export default CardGrid;
