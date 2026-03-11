import React, { type ReactNode } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';

export interface ToolbarProps {
  label: string;
  orientation?: 'horizontal' | 'vertical';
  children?: ReactNode;
  style?: ViewStyle;
}

export interface ToolbarGroupProps {
  children?: ReactNode;
  style?: ViewStyle;
}

export interface ToolbarSeparatorProps {
  orientation?: 'horizontal' | 'vertical';
  style?: ViewStyle;
}

export const ToolbarGroup: React.FC<ToolbarGroupProps> = ({ children, style }) => (
  <View style={[tStyles.group, style]}>{children}</View>
);
ToolbarGroup.displayName = 'ToolbarGroup';

export const ToolbarSeparator: React.FC<ToolbarSeparatorProps> = ({ orientation = 'horizontal', style }) => (
  <View style={[orientation === 'horizontal' ? tStyles.separatorV : tStyles.separatorH, style]} />
);
ToolbarSeparator.displayName = 'ToolbarSeparator';

export const Toolbar: React.FC<ToolbarProps> = ({
  label,
  orientation = 'horizontal',
  children,
  style,
}) => (
  <View
    style={[tStyles.root, orientation === 'vertical' && tStyles.vertical, style]}
    accessibilityRole="toolbar"
    accessibilityLabel={label}
  >
    {children}
  </View>
);

const tStyles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  vertical: { flexDirection: 'column' },
  group: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  separatorV: { width: 1, height: 20, backgroundColor: '#e2e8f0', marginHorizontal: 4 },
  separatorH: { height: 1, width: 20, backgroundColor: '#e2e8f0', marginVertical: 4 },
});

Toolbar.displayName = 'Toolbar';
export default Toolbar;
