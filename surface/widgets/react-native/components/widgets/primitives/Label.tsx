import React, { type ReactNode } from 'react';
import { Text, StyleSheet, type TextStyle } from 'react-native';

// Props from label.widget spec
export interface LabelProps {
  text?: string;
  required?: boolean;
  children?: ReactNode;
  style?: TextStyle;
}

export const Label: React.FC<LabelProps> = ({
  text = '',
  required = false,
  children,
  style,
}) => {
  return (
    <Text style={[styles.root, style]} accessibilityRole="text">
      {children || text}
      {required && <Text style={styles.required}> *</Text>}
    </Text>
  );
};

const styles = StyleSheet.create({
  root: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
  },
  required: {
    color: '#ef4444',
  },
});

Label.displayName = 'Label';
export default Label;
