import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';

export interface StepDef { id: string; label: string; description?: string; }

export interface StepIndicatorProps {
  steps: StepDef[]; currentStep?: number; orientation?: 'horizontal' | 'vertical';
  style?: ViewStyle;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ steps, currentStep = 0, orientation = 'horizontal', style }) => (
  <View style={[styles.root, orientation === 'vertical' && styles.vertical, style]} accessibilityRole="progressbar">
    {steps.map((step, i) => {
      const state = i < currentStep ? 'completed' : i === currentStep ? 'current' : 'upcoming';
      return (
        <View key={step.id} style={[styles.step, orientation === 'vertical' && styles.stepVertical]}>
          <View style={[styles.dot, state === 'completed' && styles.completedDot, state === 'current' && styles.currentDot]}>
            <Text style={styles.dotText}>{state === 'completed' ? '\u2713' : i + 1}</Text>
          </View>
          <View style={styles.stepInfo}><Text style={[styles.stepLabel, state === 'current' && styles.currentLabel]}>{step.label}</Text>{step.description && <Text style={styles.stepDesc}>{step.description}</Text>}</View>
          {i < steps.length - 1 && <View style={[styles.connector, orientation === 'vertical' && styles.connectorVertical]} />}
        </View>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'flex-start' },
  vertical: { flexDirection: 'column' },
  step: { flex: 1, alignItems: 'center' },
  stepVertical: { flexDirection: 'row', marginBottom: 12 },
  dot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
  completedDot: { backgroundColor: '#22c55e' },
  currentDot: { backgroundColor: '#3b82f6' },
  dotText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  stepInfo: { alignItems: 'center', marginTop: 4 },
  stepLabel: { fontSize: 12, color: '#64748b', textAlign: 'center' },
  currentLabel: { color: '#3b82f6', fontWeight: '600' },
  stepDesc: { fontSize: 11, color: '#94a3b8', textAlign: 'center' },
  connector: { position: 'absolute', height: 2, backgroundColor: '#e2e8f0', top: 14, left: '60%', right: '-40%' },
  connectorVertical: { position: 'absolute', width: 2, left: 14, top: 28, bottom: -12, height: undefined },
});

StepIndicator.displayName = 'StepIndicator';
export default StepIndicator;
