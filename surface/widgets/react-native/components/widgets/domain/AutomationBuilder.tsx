import React, { useState, useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

export interface AutomationStep { id: string; type: string; label: string; config?: Record<string, unknown>; }

export interface AutomationBuilderProps {
  steps: AutomationStep[];
  onAddStep?: () => void;
  onRemoveStep?: (id: string) => void;
  onReorderSteps?: (steps: AutomationStep[]) => void;
  onStepSelect?: (id: string) => void;
  style?: ViewStyle;
}

export const AutomationBuilder: React.FC<AutomationBuilderProps> = ({
  steps, onAddStep, onRemoveStep, onStepSelect, style,
}) => (
  <ScrollView style={[styles.root, style]}>
    <Text style={styles.heading}>Automation Steps</Text>
    {steps.map((step, i) => (
      <Pressable key={step.id} onPress={() => onStepSelect?.(step.id)} style={styles.step} accessibilityRole="button">
        <Text style={styles.stepNum}>{i + 1}</Text>
        <View style={styles.stepInfo}><Text style={styles.stepLabel}>{step.label}</Text><Text style={styles.stepType}>{step.type}</Text></View>
        {onRemoveStep && <Pressable onPress={() => onRemoveStep(step.id)} hitSlop={8}><Text style={styles.remove}>\u00D7</Text></Pressable>}
      </Pressable>
    ))}
    {onAddStep && <Pressable onPress={onAddStep} style={styles.addButton}><Text style={styles.addText}>+ Add Step</Text></Pressable>}
  </ScrollView>
);

const styles = StyleSheet.create({
  root: { padding: 12 },
  heading: { fontSize: 15, fontWeight: '600', color: '#1e293b', marginBottom: 12 },
  step: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, marginBottom: 8 },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#3b82f6', color: '#fff', textAlign: 'center', lineHeight: 28, fontSize: 13, fontWeight: '600', marginRight: 10 },
  stepInfo: { flex: 1 },
  stepLabel: { fontSize: 14, fontWeight: '500', color: '#1e293b' },
  stepType: { fontSize: 12, color: '#64748b' },
  remove: { fontSize: 20, color: '#94a3b8' },
  addButton: { padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, borderStyle: 'dashed' },
  addText: { fontSize: 14, color: '#3b82f6', fontWeight: '500' },
});

AutomationBuilder.displayName = 'AutomationBuilder';
export default AutomationBuilder;
