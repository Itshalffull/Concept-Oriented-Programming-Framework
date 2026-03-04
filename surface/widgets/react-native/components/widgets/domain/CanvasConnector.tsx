import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';

export interface CanvasConnectorProps {
  fromX: number; fromY: number; toX: number; toY: number;
  color?: string; strokeWidth?: number;
  style?: ViewStyle;
}

export const CanvasConnector: React.FC<CanvasConnectorProps> = ({
  fromX, fromY, toX, toY, color = '#94a3b8', strokeWidth = 2, style,
}) => {
  const left = Math.min(fromX, toX);
  const top = Math.min(fromY, toY);
  const w = Math.abs(toX - fromX) || 2;
  const h = Math.abs(toY - fromY) || 2;

  return (
    <View style={[styles.root, { left, top, width: w, height: h }, style]} accessibilityRole="image" accessibilityLabel="Connector">
      <View style={[styles.line, { backgroundColor: color, height: strokeWidth, transform: [{ rotate: `${Math.atan2(toY - fromY, toX - fromX) * 180 / Math.PI}deg` }] }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { position: 'absolute' },
  line: { position: 'absolute', width: '100%', top: '50%' },
});

CanvasConnector.displayName = 'CanvasConnector';
export default CanvasConnector;
