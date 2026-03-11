import React, { useState, useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export type ViewType = string;
export interface ViewDef { id: string; label: string; icon?: ReactNode; }

export interface ViewSwitcherProps {
  views: ViewDef[];
  activeView?: string;
  defaultView?: string;
  onViewChange?: (viewId: string) => void;
  style?: ViewStyle;
}

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  views, activeView, defaultView, onViewChange, style,
}) => {
  const [internalView, setInternalView] = useState(defaultView || views[0]?.id);
  const current = activeView ?? internalView;

  const handleSwitch = useCallback((id: string) => {
    setInternalView(id);
    onViewChange?.(id);
  }, [onViewChange]);

  return (
    <View style={[styles.root, style]} accessibilityRole="radiogroup">
      {views.map(v => {
        const isActive = v.id === current;
        return (
          <Pressable key={v.id} onPress={() => handleSwitch(v.id)} style={[styles.option, isActive && styles.active]} accessibilityRole="radio" accessibilityState={{ selected: isActive }}>
            {v.icon && <View style={styles.icon}>{v.icon}</View>}
            <Text style={[styles.label, isActive && styles.activeLabel]}>{v.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 6, padding: 2 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 4 },
  active: { backgroundColor: '#fff', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  icon: { marginRight: 4 },
  label: { fontSize: 13, color: '#64748b' },
  activeLabel: { color: '#1e293b', fontWeight: '500' },
});

ViewSwitcher.displayName = 'ViewSwitcher';
export default ViewSwitcher;
