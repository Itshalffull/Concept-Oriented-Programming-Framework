import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export type PanelVisibility = 'expanded' | 'collapsed' | 'minimized';

export interface CanvasPanelTab {
  id: string;
  label: string;
}

export interface CanvasPanelProps {
  canvasId: string;
  title?: string;
  dock?: 'left' | 'right';
  collapsible?: boolean;
  initialState?: PanelVisibility;
  tabs?: CanvasPanelTab[];
  activeTab?: string;
  children: React.ReactNode;
  onCollapse?: () => void;
  onExpand?: () => void;
  onTabChange?: (tabId: string) => void;
  style?: ViewStyle;
}

export const CanvasPanel: React.FC<CanvasPanelProps> = ({
  canvasId, title = 'Panel', dock = 'right',
  collapsible = true, initialState = 'expanded',
  tabs, activeTab, children,
  onCollapse, onExpand, onTabChange, style,
}) => {
  const [visibility, setVisibility] = useState<PanelVisibility>(initialState);
  const [currentTab, setCurrentTab] = useState(activeTab ?? tabs?.[0]?.id ?? '');

  const handleToggle = () => {
    if (visibility === 'expanded') {
      setVisibility('collapsed');
      onCollapse?.();
    } else {
      setVisibility('expanded');
      onExpand?.();
    }
  };

  const handleTabPress = (tabId: string) => {
    setCurrentTab(tabId);
    onTabChange?.(tabId);
  };

  const dockBorder = dock === 'left'
    ? { borderRightWidth: 1, borderColor: '#e2e8f0' }
    : { borderLeftWidth: 1, borderColor: '#e2e8f0' };

  if (visibility === 'minimized') {
    return (
      <View style={[styles.minimized, dockBorder, style]} accessibilityRole="summary" accessibilityLabel={`${title} panel minimized`}>
        <Pressable onPress={() => { setVisibility('expanded'); onExpand?.(); }} accessibilityRole="button" accessibilityLabel={`Expand ${title}`}>
          <Text style={styles.minimizedText}>{title}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, dockBorder, style]} accessibilityRole="summary" accessibilityLabel={`${title} panel`}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {collapsible && (
          <Pressable
            style={styles.collapseTrigger}
            onPress={handleToggle}
            accessibilityRole="button"
            accessibilityLabel={visibility === 'expanded' ? `Collapse ${title}` : `Expand ${title}`}
          >
            <Text style={styles.collapseIcon}>{visibility === 'expanded' ? '\u25B2' : '\u25BC'}</Text>
          </Pressable>
        )}
      </View>

      {tabs && tabs.length > 0 && visibility === 'expanded' && (
        <View style={styles.tabBar} accessibilityRole="tablist">
          {tabs.map(tab => (
            <Pressable
              key={tab.id}
              style={[styles.tab, currentTab === tab.id && styles.tabActive]}
              onPress={() => handleTabPress(tab.id)}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
            >
              <Text style={[styles.tabText, currentTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {visibility === 'expanded' && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} accessibilityLabel={`${title} content`}>
          {children}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  minimized: { width: 36, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', paddingVertical: 12 },
  minimizedText: { fontSize: 11, fontWeight: '600', color: '#64748b', transform: [{ rotate: '-90deg' }] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  title: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  collapseTrigger: { width: 24, height: 24, borderRadius: 4, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' },
  collapseIcon: { fontSize: 10, color: '#64748b' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10 },
  tab: { paddingHorizontal: 12, paddingVertical: 8, marginRight: 2 },
  tabActive: { borderBottomWidth: 2, borderColor: '#3b82f6' },
  tabText: { fontSize: 12, fontWeight: '500', color: '#94a3b8' },
  tabTextActive: { color: '#3b82f6' },
  body: { flex: 1 },
  bodyContent: { padding: 14 },
});

CanvasPanel.displayName = 'CanvasPanel';
export default CanvasPanel;
