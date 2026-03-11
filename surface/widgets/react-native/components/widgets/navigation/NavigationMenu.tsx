import React, { useState, useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface NavigationMenuItem {
  type: 'trigger' | 'link';
  label: string;
  href?: string;
  active?: boolean;
  content?: ReactNode;
}

export interface NavigationMenuProps {
  items: NavigationMenuItem[];
  orientation?: 'horizontal' | 'vertical';
  onNavigate?: (href: string) => void;
  style?: ViewStyle;
}

export const NavigationMenu: React.FC<NavigationMenuProps> = ({
  items,
  orientation = 'horizontal',
  onNavigate,
  style,
}) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const handleToggle = useCallback((index: number) => {
    setOpenIndex(prev => prev === index ? null : index);
  }, []);

  const handleNavigate = useCallback((href?: string) => {
    setOpenIndex(null);
    if (href) onNavigate?.(href);
  }, [onNavigate]);

  return (
    <View
      style={[styles.root, orientation === 'vertical' && styles.vertical, style]}
      accessibilityRole="navigation"
      accessibilityLabel="Main navigation"
    >
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        if (item.type === 'trigger') {
          return (
            <View key={`${item.label}-${index}`}>
              <Pressable
                onPress={() => handleToggle(index)}
                style={[styles.triggerButton, isOpen && styles.activeTrigger]}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
              >
                <Text style={styles.triggerText}>{item.label}</Text>
              </Pressable>
              {isOpen && item.content && <View style={styles.panel}>{item.content}</View>}
            </View>
          );
        }
        return (
          <Pressable
            key={`${item.label}-${index}`}
            onPress={() => handleNavigate(item.href)}
            style={[styles.link, item.active && styles.activeLink]}
            accessibilityRole="link"
          >
            <Text style={[styles.linkText, item.active && styles.activeLinkText]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  vertical: { flexDirection: 'column' },
  triggerButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  activeTrigger: { backgroundColor: '#f1f5f9' },
  triggerText: { fontSize: 14, fontWeight: '500', color: '#1e293b' },
  link: { paddingVertical: 8, paddingHorizontal: 12 },
  activeLink: { borderBottomWidth: 2, borderBottomColor: '#3b82f6' },
  linkText: { fontSize: 14, color: '#475569' },
  activeLinkText: { color: '#3b82f6', fontWeight: '500' },
  panel: { padding: 12, backgroundColor: '#fff', borderRadius: 8, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, marginTop: 4 },
});

NavigationMenu.displayName = 'NavigationMenu';
export default NavigationMenu;
