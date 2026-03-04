import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, type ViewStyle } from 'react-native';

// Props from spinner.widget spec
export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  trackVisible?: boolean;
  style?: ViewStyle;
}

const sizeMap = { sm: 'small' as const, md: 'small' as const, lg: 'large' as const };

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  label,
  trackVisible = true,
  style,
}) => {
  const accessibleLabel = label || 'Loading';

  return (
    <View
      style={[styles.root, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibleLabel}
      accessibilityState={{ busy: true }}
    >
      <ActivityIndicator
        size={sizeMap[size]}
        color="#3b82f6"
      />
      {label && (
        <Text style={styles.label}>{label}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 8,
    fontSize: 13,
    color: '#64748b',
  },
});

Spinner.displayName = 'Spinner';
export default Spinner;
