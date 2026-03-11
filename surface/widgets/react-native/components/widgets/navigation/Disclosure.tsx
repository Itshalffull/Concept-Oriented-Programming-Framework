import React, { useState, useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface DisclosureProps {
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
  triggerContent?: ReactNode;
  style?: ViewStyle;
}

export const Disclosure: React.FC<DisclosureProps> = ({
  open: controlledOpen,
  defaultOpen = false,
  disabled = false,
  onOpenChange,
  children,
  triggerContent,
  style,
}) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledOpen ?? internalOpen;

  const handleToggle = useCallback(() => {
    if (disabled) return;
    const next = !isOpen;
    setInternalOpen(next);
    onOpenChange?.(next);
  }, [disabled, isOpen, onOpenChange]);

  return (
    <View style={[styles.root, style]}>
      <Pressable
        onPress={handleToggle}
        style={[styles.trigger, disabled && styles.disabled]}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen, disabled }}
      >
        <Text style={styles.indicator}>{isOpen ? '\u25BC' : '\u25B6'}</Text>
        {triggerContent}
      </Pressable>
      {isOpen && <View style={styles.content}>{children}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {},
  trigger: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  indicator: { fontSize: 10, color: '#64748b', marginRight: 8 },
  content: { paddingLeft: 18 },
  disabled: { opacity: 0.5 },
});

Disclosure.displayName = 'Disclosure';
export default Disclosure;
