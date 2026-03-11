import React, { useState, type ReactNode } from 'react';
import { View, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

export interface CanvasViewport { x: number; y: number; zoom: number; }

export interface CanvasProps {
  width?: number;
  height?: number;
  viewport?: CanvasViewport;
  onViewportChange?: (viewport: CanvasViewport) => void;
  children?: ReactNode;
  style?: ViewStyle;
}

export const Canvas: React.FC<CanvasProps> = ({
  width = 2000, height = 2000, viewport, children, style,
}) => (
  <ScrollView horizontal style={[styles.root, style]}>
    <ScrollView>
      <View style={{ width, height, position: 'relative' }} accessibilityRole="image" accessibilityLabel="Canvas">
        {children}
      </View>
    </ScrollView>
  </ScrollView>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
});

Canvas.displayName = 'Canvas';
export default Canvas;
