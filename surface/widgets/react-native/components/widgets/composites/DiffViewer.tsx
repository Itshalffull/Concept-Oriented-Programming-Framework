import React, { useState, type ReactNode } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface DiffLine { type: 'add' | 'remove' | 'context'; content: string; lineNumber?: number; }
export interface DiffHunk { header: string; lines: DiffLine[]; }
export interface FileDiff { filename: string; hunks: DiffHunk[]; additions: number; deletions: number; }

export interface DiffViewerProps {
  files: FileDiff[];
  viewMode?: 'unified' | 'split';
  showLineNumbers?: boolean;
  onFileSelect?: (filename: string) => void;
  style?: ViewStyle;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  files,
  viewMode = 'unified',
  showLineNumbers = true,
  onFileSelect,
  style,
}) => (
  <ScrollView style={[styles.root, style]}>
    {files.map(file => (
      <View key={file.filename} style={styles.file}>
        <Pressable onPress={() => onFileSelect?.(file.filename)} style={styles.fileHeader}>
          <Text style={styles.filename}>{file.filename}</Text>
          <Text style={styles.stats}>
            <Text style={styles.additions}>+{file.additions}</Text>{' '}
            <Text style={styles.deletions}>-{file.deletions}</Text>
          </Text>
        </Pressable>
        {file.hunks.map((hunk, hi) => (
          <View key={hi}>
            <Text style={styles.hunkHeader}>{hunk.header}</Text>
            {hunk.lines.map((line, li) => (
              <View key={li} style={[styles.line, line.type === 'add' && styles.addLine, line.type === 'remove' && styles.removeLine]}>
                {showLineNumbers && <Text style={styles.lineNum}>{line.lineNumber ?? ''}</Text>}
                <Text style={styles.linePrefix}>{line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}</Text>
                <Text style={styles.lineContent}>{line.content}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    ))}
  </ScrollView>
);

const styles = StyleSheet.create({
  root: {},
  file: { marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden' },
  fileHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  filename: { fontSize: 13, fontWeight: '500', color: '#1e293b', fontFamily: 'monospace' },
  stats: { fontSize: 12 },
  additions: { color: '#22c55e' },
  deletions: { color: '#ef4444' },
  hunkHeader: { fontSize: 12, color: '#64748b', backgroundColor: '#f1f5f9', padding: 4, paddingHorizontal: 10, fontFamily: 'monospace' },
  line: { flexDirection: 'row', paddingHorizontal: 4, paddingVertical: 1 },
  addLine: { backgroundColor: '#dcfce7' },
  removeLine: { backgroundColor: '#fee2e2' },
  lineNum: { width: 36, fontSize: 11, color: '#94a3b8', textAlign: 'right', marginRight: 4, fontFamily: 'monospace' },
  linePrefix: { width: 12, fontSize: 12, fontFamily: 'monospace', color: '#475569' },
  lineContent: { flex: 1, fontSize: 12, fontFamily: 'monospace', color: '#1e293b' },
});

DiffViewer.displayName = 'DiffViewer';
export default DiffViewer;
