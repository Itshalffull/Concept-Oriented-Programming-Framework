import React, { useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: ReactNode;
  onNavigate?: (href: string) => void;
  style?: ViewStyle;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  separator = '/',
  onNavigate,
  style,
}) => {
  const handlePress = useCallback((href?: string) => {
    if (href) onNavigate?.(href);
  }, [onNavigate]);

  return (
    <View style={[styles.root, style]} accessibilityRole="navigation" accessibilityLabel="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <View key={`${item.label}-${index}`} style={styles.item}>
            {isLast ? (
              <Text style={styles.current} accessibilityRole="text">{item.label}</Text>
            ) : (
              <>
                <Pressable onPress={() => handlePress(item.href)} accessibilityRole="link">
                  <Text style={styles.link}>{item.label}</Text>
                </Pressable>
                <Text style={styles.separator}>{typeof separator === 'string' ? separator : ''}</Text>
                {typeof separator !== 'string' && separator}
              </>
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  item: { flexDirection: 'row', alignItems: 'center' },
  link: { fontSize: 14, color: '#3b82f6' },
  current: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  separator: { fontSize: 14, color: '#94a3b8', marginHorizontal: 6 },
});

Breadcrumb.displayName = 'Breadcrumb';
export default Breadcrumb;
