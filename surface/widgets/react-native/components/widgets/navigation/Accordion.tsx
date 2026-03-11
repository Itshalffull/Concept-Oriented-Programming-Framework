import React, { useState, useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface AccordionItem {
  id: string;
  trigger: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface AccordionProps {
  items: AccordionItem[];
  multiple?: boolean;
  collapsible?: boolean;
  defaultValue?: string[];
  value?: string[];
  onValueChange?: (value: string[]) => void;
  style?: ViewStyle;
}

export const Accordion: React.FC<AccordionProps> = ({
  items,
  multiple = false,
  collapsible = true,
  defaultValue = [],
  value: controlledValue,
  onValueChange,
  style,
}) => {
  const [internalValue, setInternalValue] = useState<string[]>(defaultValue);
  const openItems = controlledValue ?? internalValue;

  const handleToggle = useCallback((id: string) => {
    const isOpen = openItems.includes(id);
    let next: string[];
    if (isOpen) {
      next = collapsible ? openItems.filter(v => v !== id) : openItems;
    } else {
      next = multiple ? [...openItems, id] : [id];
    }
    setInternalValue(next);
    onValueChange?.(next);
  }, [openItems, multiple, collapsible, onValueChange]);

  return (
    <View style={[styles.root, style]} accessibilityRole="list">
      {items.map((item) => {
        const isOpen = openItems.includes(item.id);
        return (
          <View key={item.id} style={styles.item}>
            <Pressable
              onPress={() => !item.disabled && handleToggle(item.id)}
              style={[styles.trigger, item.disabled && styles.disabled]}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen, disabled: item.disabled }}
            >
              {typeof item.trigger === 'string' ? <Text style={styles.triggerText}>{item.trigger}</Text> : item.trigger}
              <Text style={styles.indicator}>{isOpen ? '\u25B2' : '\u25BC'}</Text>
            </Pressable>
            {isOpen && <View style={styles.content}>{item.content}</View>}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden' },
  item: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  trigger: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  triggerText: { fontSize: 14, fontWeight: '500', color: '#1e293b', flex: 1 },
  indicator: { fontSize: 10, color: '#94a3b8', marginLeft: 8 },
  content: { padding: 12, backgroundColor: '#f8fafc' },
  disabled: { opacity: 0.5 },
});

Accordion.displayName = 'Accordion';
export default Accordion;
