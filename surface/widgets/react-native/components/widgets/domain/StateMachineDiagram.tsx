import React from 'react';
import { View, Text, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

export interface StateDef { id: string; label: string; type?: 'initial' | 'final' | 'normal'; }
export interface TransitionDef { from: string; to: string; event: string; }

export interface StateMachineDiagramProps {
  states: StateDef[]; transitions: TransitionDef[];
  activeState?: string; style?: ViewStyle;
}

export const StateMachineDiagram: React.FC<StateMachineDiagramProps> = ({ states, transitions, activeState, style }) => (
  <ScrollView horizontal style={[styles.root, style]} accessibilityRole="image" accessibilityLabel="State machine diagram">
    <View style={styles.container}>
      {states.map(s => (
        <View key={s.id} style={[styles.state, s.id === activeState && styles.activeState, s.type === 'initial' && styles.initialState, s.type === 'final' && styles.finalState]}>
          <Text style={[styles.stateLabel, s.id === activeState && styles.activeLabel]}>{s.label}</Text>
        </View>
      ))}
      {transitions.map((t, i) => (
        <View key={i} style={styles.transition}><Text style={styles.transitionText}>{t.from} \u2192 {t.to} [{t.event}]</Text></View>
      ))}
    </View>
  </ScrollView>
);

const styles = StyleSheet.create({
  root: {},
  container: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 16, alignItems: 'flex-start' },
  state: { paddingVertical: 10, paddingHorizontal: 16, borderWidth: 2, borderColor: '#cbd5e1', borderRadius: 20 },
  activeState: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  initialState: { borderStyle: 'dashed' },
  finalState: { borderWidth: 3 },
  stateLabel: { fontSize: 13, fontWeight: '500', color: '#1e293b' },
  activeLabel: { color: '#3b82f6' },
  transition: { paddingVertical: 4 },
  transitionText: { fontSize: 12, color: '#64748b', fontFamily: 'monospace' },
});

StateMachineDiagram.displayName = 'StateMachineDiagram';
export default StateMachineDiagram;
