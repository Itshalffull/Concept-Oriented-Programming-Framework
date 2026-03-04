import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';

export interface MinimapProps {
  contentWidth?: number; contentHeight?: number;
  viewportX?: number; viewportY?: number; viewportWidth?: number; viewportHeight?: number;
  style?: ViewStyle;
}

export const Minimap: React.FC<MinimapProps> = ({
  contentWidth = 1000, contentHeight = 1000,
  viewportX = 0, viewportY = 0, viewportWidth = 200, viewportHeight = 200,
  style,
}) => {
  const scale = 0.1;
  return (
    <View style={[styles.root, { width: contentWidth * scale, height: contentHeight * scale }, style]} accessibilityRole="image" accessibilityLabel="Minimap">
      <View style={[styles.viewport, { left: viewportX * scale, top: viewportY * scale, width: viewportWidth * scale, height: viewportHeight * scale }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' },
  viewport: { position: 'absolute', borderWidth: 1, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)' },
});

Minimap.displayName = 'Minimap';
export default Minimap;
