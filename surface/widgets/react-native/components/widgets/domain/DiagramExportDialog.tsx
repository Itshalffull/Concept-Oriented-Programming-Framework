import React, { useState } from 'react';
import { View, Text, TextInput, Switch, Pressable, Modal, StyleSheet, type ViewStyle } from 'react-native';

export interface ExportFormat {
  name: string;
  label: string;
  mime_type: string;
}

export interface DiagramExportDialogProps {
  visible: boolean;
  canvasId: string;
  formats?: ExportFormat[];
  defaultWidth?: number;
  defaultHeight?: number;
  onExport?: (params: { format: string; width: number; height: number; includeBackground: boolean; embedData: boolean }) => void;
  onCancel?: () => void;
  style?: ViewStyle;
}

export const DiagramExportDialog: React.FC<DiagramExportDialogProps> = ({
  visible, canvasId, formats = [], defaultWidth = 1920, defaultHeight = 1080,
  onExport, onCancel, style,
}) => {
  const [selectedFormat, setSelectedFormat] = useState(formats[0]?.name ?? '');
  const [width, setWidth] = useState(String(defaultWidth));
  const [height, setHeight] = useState(String(defaultHeight));
  const [includeBackground, setIncludeBackground] = useState(true);
  const [embedData, setEmbedData] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    if (!selectedFormat) return;
    setExporting(true);
    onExport?.({ format: selectedFormat, width: parseInt(width, 10) || defaultWidth, height: parseInt(height, 10) || defaultHeight, includeBackground, embedData });
    setTimeout(() => setExporting(false), 500);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.dialog, style]} accessibilityRole="none" accessibilityLabel="Export diagram">
          <Text style={styles.title}>Export Diagram</Text>

          <Text style={styles.fieldLabel}>Format</Text>
          <View style={styles.formatRow}>
            {formats.map(f => (
              <Pressable
                key={f.name}
                style={[styles.formatChip, selectedFormat === f.name && styles.formatChipActive]}
                onPress={() => setSelectedFormat(f.name)}
                accessibilityRole="button"
                accessibilityLabel={f.label}
              >
                <Text style={[styles.formatChipText, selectedFormat === f.name && styles.formatChipTextActive]}>{f.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Size</Text>
          <View style={styles.sizeRow}>
            <TextInput style={styles.sizeInput} value={width} onChangeText={setWidth} keyboardType="numeric" accessibilityLabel="Width" placeholder="Width" />
            <Text style={styles.sizeX}>x</Text>
            <TextInput style={styles.sizeInput} value={height} onChangeText={setHeight} keyboardType="numeric" accessibilityLabel="Height" placeholder="Height" />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Include background</Text>
            <Switch value={includeBackground} onValueChange={setIncludeBackground} />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Embed round-trip data</Text>
            <Switch value={embedData} onValueChange={setEmbedData} />
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel">
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.exportBtn, (!selectedFormat || exporting) && styles.exportBtnDisabled]}
              onPress={handleExport}
              disabled={!selectedFormat || exporting}
              accessibilityRole="button"
              accessibilityLabel={`Export as ${selectedFormat}`}
            >
              <Text style={styles.exportBtnText}>{exporting ? 'Exporting...' : 'Export'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  dialog: { width: 340, backgroundColor: '#fff', borderRadius: 12, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  title: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 6, marginTop: 12 },
  formatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  formatChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  formatChipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  formatChipText: { fontSize: 12, fontWeight: '500', color: '#475569' },
  formatChipTextActive: { color: '#fff' },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sizeInput: { flex: 1, height: 36, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, paddingHorizontal: 10, fontSize: 13, backgroundColor: '#f8fafc' },
  sizeX: { fontSize: 14, color: '#94a3b8', fontWeight: '500' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  toggleLabel: { fontSize: 13, color: '#334155' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f1f5f9' },
  cancelBtnText: { fontSize: 14, fontWeight: '500', color: '#475569' },
  exportBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#3b82f6' },
  exportBtnDisabled: { backgroundColor: '#94a3b8' },
  exportBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});

DiagramExportDialog.displayName = 'DiagramExportDialog';
export default DiagramExportDialog;
