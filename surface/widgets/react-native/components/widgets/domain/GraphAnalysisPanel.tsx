import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, FlatList,
  ActivityIndicator, Switch, StyleSheet, type ViewStyle,
} from 'react-native';
import { CanvasPanel } from './CanvasPanel';

export type AnalysisCategory = 'centrality' | 'community' | 'path' | 'pattern' | 'flow' | 'structural' | 'clustering';
export type ReportFormat = 'table' | 'summary' | 'dashboard';
export type WorkflowState = 'idle' | 'configuring' | 'running' | 'showingResults' | 'showingReport' | 'comparing';

const CATEGORIES: { value: AnalysisCategory; label: string }[] = [
  { value: 'centrality', label: 'Centrality' },
  { value: 'community', label: 'Community' },
  { value: 'path', label: 'Path' },
  { value: 'pattern', label: 'Pattern' },
  { value: 'flow', label: 'Flow' },
  { value: 'structural', label: 'Structural' },
  { value: 'clustering', label: 'Clustering' },
];

const REPORT_FORMATS: { value: ReportFormat; label: string }[] = [
  { value: 'table', label: 'Table' },
  { value: 'summary', label: 'Summary' },
  { value: 'dashboard', label: 'Dashboard' },
];

export interface AnalysisResultItem {
  id: string;
  label: string;
  score: number;
}

export interface GraphAnalysisPanelProps {
  canvasId: string;
  graphData?: string;
  selectedCategory: AnalysisCategory;
  selectedAlgorithm?: string;
  resultId?: string;
  overlayKinds?: string[];
  reportFormat?: ReportFormat;
  autoOverlay?: boolean;
  onRun?: (params: { category: AnalysisCategory; algorithm: string }) => void;
  onOverlayToggle?: (kind: string, enabled: boolean) => void;
  onGenerateReport?: (format: ReportFormat) => void;
  onExport?: () => void;
  onCompare?: () => void;
  style?: ViewStyle;
}

export const GraphAnalysisPanel: React.FC<GraphAnalysisPanelProps> = ({
  canvasId, graphData, selectedCategory,
  selectedAlgorithm = '', resultId,
  overlayKinds = [], reportFormat = 'table',
  autoOverlay = false,
  onRun, onOverlayToggle, onGenerateReport, onExport, onCompare, style,
}) => {
  const [workflow, setWorkflow] = useState<WorkflowState>('idle');
  const [category, setCategory] = useState<AnalysisCategory>(selectedCategory);
  const [algorithm, setAlgorithm] = useState(selectedAlgorithm);
  const [overlays, setOverlays] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    overlayKinds.forEach(k => { init[k] = autoOverlay; });
    return init;
  });
  const [format, setFormat] = useState<ReportFormat>(reportFormat);
  const [results] = useState<AnalysisResultItem[]>([]);

  const handleRun = () => {
    if (!algorithm) return;
    setWorkflow('running');
    onRun?.({ category, algorithm });
    setTimeout(() => setWorkflow('showingResults'), 600);
  };

  const handleOverlayToggle = (kind: string, value: boolean) => {
    setOverlays(prev => ({ ...prev, [kind]: value }));
    onOverlayToggle?.(kind, value);
  };

  const handleGenerateReport = (fmt: ReportFormat) => {
    setFormat(fmt);
    setWorkflow('showingReport');
    onGenerateReport?.(fmt);
  };

  return (
    <CanvasPanel canvasId={canvasId} title="Analysis" dock="right" style={style}>
      {/* Category tabs */}
      <Text style={styles.sectionLabel}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={styles.categoryRow}>
        {CATEGORIES.map(c => (
          <Pressable
            key={c.value}
            style={[styles.chip, category === c.value && styles.chipActive]}
            onPress={() => { setCategory(c.value); setWorkflow('configuring'); }}
            accessibilityRole="button"
            accessibilityLabel={c.label}
          >
            <Text style={[styles.chipText, category === c.value && styles.chipTextActive]}>{c.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Algorithm selector */}
      <Text style={styles.sectionLabel}>Algorithm</Text>
      <Pressable
        style={styles.dropdown}
        onPress={() => setWorkflow('configuring')}
        accessibilityRole="button"
        accessibilityLabel="Select algorithm"
      >
        <Text style={styles.dropdownText}>{algorithm || 'Select algorithm...'}</Text>
        <Text style={styles.dropdownCaret}>{'\u25BC'}</Text>
      </Pressable>

      {/* Run button */}
      <Pressable
        style={[styles.runBtn, (!algorithm || workflow === 'running') && styles.runBtnDisabled]}
        onPress={handleRun}
        disabled={!algorithm || workflow === 'running'}
        accessibilityRole="button"
        accessibilityLabel="Run analysis"
      >
        <Text style={styles.runBtnText}>{workflow === 'running' ? 'Running...' : 'Run Analysis'}</Text>
      </Pressable>

      {/* Status bar */}
      {workflow === 'running' && (
        <View style={styles.statusBar} accessibilityLabel="Analysis running">
          <ActivityIndicator size="small" color="#3b82f6" />
          <Text style={styles.statusText}>Running {category} analysis...</Text>
        </View>
      )}

      {/* Results panel */}
      {(workflow === 'showingResults' || workflow === 'showingReport' || workflow === 'comparing') && (
        <View style={styles.resultsSection}>
          <Text style={styles.sectionLabel}>Results{resultId ? ` (${resultId})` : ''}</Text>
          {results.length === 0 ? (
            <Text style={styles.emptyText}>No results to display.</Text>
          ) : (
            <FlatList
              data={results}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.resultRow} accessibilityLabel={`${item.label}: ${item.score}`}>
                  <Text style={styles.resultLabel}>{item.label}</Text>
                  <Text style={styles.resultScore}>{item.score.toFixed(4)}</Text>
                </View>
              )}
            />
          )}
        </View>
      )}

      {/* Overlay controls */}
      {overlayKinds.length > 0 && (workflow === 'showingResults' || workflow === 'showingReport') && (
        <View style={styles.overlaySection}>
          <Text style={styles.sectionLabel}>Overlays</Text>
          {overlayKinds.map(kind => (
            <View key={kind} style={styles.overlayRow} accessibilityLabel={`${kind} overlay`}>
              <Text style={styles.overlayLabel}>{kind}</Text>
              <Switch
                value={overlays[kind] ?? false}
                onValueChange={val => handleOverlayToggle(kind, val)}
                accessibilityLabel={`Toggle ${kind} overlay`}
              />
            </View>
          ))}
        </View>
      )}

      {/* Report section */}
      {(workflow === 'showingResults' || workflow === 'showingReport') && (
        <View style={styles.reportSection}>
          <Text style={styles.sectionLabel}>Report</Text>
          <View style={styles.chipRow}>
            {REPORT_FORMATS.map(f => (
              <Pressable
                key={f.value}
                style={[styles.chip, format === f.value && styles.chipActive]}
                onPress={() => handleGenerateReport(f.value)}
                accessibilityRole="button"
                accessibilityLabel={`${f.label} format`}
              >
                <Text style={[styles.chipText, format === f.value && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.actionRow}>
            <Pressable style={styles.secondaryBtn} onPress={onExport} accessibilityRole="button" accessibilityLabel="Export results">
              <Text style={styles.secondaryBtnText}>Export</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={() => { setWorkflow('comparing'); onCompare?.(); }} accessibilityRole="button" accessibilityLabel="Compare results">
              <Text style={styles.secondaryBtnText}>Compare</Text>
            </Pressable>
          </View>
        </View>
      )}
    </CanvasPanel>
  );
};

const styles = StyleSheet.create({
  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 6, marginTop: 10 },
  categoryScroll: { maxHeight: 40 },
  categoryRow: { flexDirection: 'row', gap: 6, paddingBottom: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  chipText: { fontSize: 12, fontWeight: '500', color: '#475569' },
  chipTextActive: { color: '#fff' },
  dropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#f8fafc' },
  dropdownText: { fontSize: 12, color: '#475569' },
  dropdownCaret: { fontSize: 8, color: '#94a3b8' },
  runBtn: { marginTop: 12, backgroundColor: '#3b82f6', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  runBtnDisabled: { backgroundColor: '#94a3b8' },
  runBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  statusBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 4, marginTop: 8, backgroundColor: '#eff6ff', borderRadius: 6 },
  statusText: { fontSize: 12, color: '#3b82f6' },
  resultsSection: { marginTop: 8 },
  emptyText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginTop: 4 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  resultLabel: { fontSize: 12, color: '#1e293b' },
  resultScore: { fontSize: 12, fontWeight: '600', color: '#3b82f6', fontFamily: 'monospace' },
  overlaySection: { marginTop: 8 },
  overlayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  overlayLabel: { fontSize: 12, color: '#475569', textTransform: 'capitalize' },
  reportSection: { marginTop: 8 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, paddingVertical: 8, alignItems: 'center', backgroundColor: '#f8fafc' },
  secondaryBtnText: { fontSize: 12, fontWeight: '500', color: '#475569' },
});

GraphAnalysisPanel.displayName = 'GraphAnalysisPanel';
export default GraphAnalysisPanel;
