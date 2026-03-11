import React, { useState, useCallback, type ReactNode } from 'react';
import {
  Pressable,
  Text,
  View,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
} from 'react-native';

// Props from button.widget spec
export interface ButtonProps {
  variant?: 'filled' | 'outline' | 'text' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  iconPosition?: 'start' | 'end';
  onPress?: () => void;
  children?: ReactNode;
  style?: ViewStyle;
}

const sizeStyles = {
  sm: { paddingVertical: 6, paddingHorizontal: 12, fontSize: 13 },
  md: { paddingVertical: 10, paddingHorizontal: 16, fontSize: 15 },
  lg: { paddingVertical: 14, paddingHorizontal: 20, fontSize: 17 },
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'filled',
  size = 'md',
  disabled = false,
  loading = false,
  iconPosition = 'start',
  onPress,
  children,
  style,
}) => {
  const [state, setState] = useState<'idle' | 'pressed'>('idle');

  const handlePress = useCallback(() => {
    if (!disabled && !loading) onPress?.();
  }, [disabled, loading, onPress]);

  const isDisabled = disabled || loading;
  const sizeStyle = sizeStyles[size];

  const bgColor =
    variant === 'filled'
      ? '#3b82f6'
      : variant === 'danger'
        ? '#ef4444'
        : 'transparent';

  const textColor =
    variant === 'filled' || variant === 'danger'
      ? '#ffffff'
      : '#3b82f6';

  const borderColor =
    variant === 'outline' ? '#3b82f6' : 'transparent';

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={() => setState('pressed')}
      onPressOut={() => setState('idle')}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={typeof children === 'string' ? children : undefined}
      style={[
        styles.root,
        {
          backgroundColor: bgColor,
          borderColor,
          borderWidth: variant === 'outline' ? 1 : 0,
          paddingVertical: sizeStyle.paddingVertical,
          paddingHorizontal: sizeStyle.paddingHorizontal,
          opacity: isDisabled ? 0.5 : state === 'pressed' ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color={textColor}
          style={styles.spinner}
        />
      )}
      <Text
        style={[
          styles.label,
          { color: textColor, fontSize: sizeStyle.fontSize },
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  spinner: {
    marginRight: 8,
  },
  label: {
    fontWeight: '600',
  },
});

Button.displayName = 'Button';
export default Button;
