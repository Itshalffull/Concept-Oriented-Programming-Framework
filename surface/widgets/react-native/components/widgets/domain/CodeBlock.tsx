import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

export interface CodeBlockProps {
  code: string; language?: string; showLineNumbers?: boolean;
  copyable?: boolean; onCopy?: () => void; style?: ViewStyle;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code, language, showLineNumbers = true, copyable = true, onCopy, style,
}) => {
  const [copied, setCopied] = useState(false);
  const lines = code.split('\n');

  const handleCopy = useCallback(() => { setCopied(true); onCopy?.(); setTimeout(() => setCopied(false), 2000); }, [onCopy]);

  return (
    <View style={[styles.root, style]}>
      <View style={styles.header}>
        {language && <Text style={styles.language}>{language}</Text>}
        {copyable && <Pressable onPress={handleCopy} accessibilityLabel="Copy code"><Text style={styles.copyButton}>{copied ? 'Copied!' : 'Copy'}</Text></Pressable>}
      </View>
      <ScrollView horizontal><View style={styles.codeArea}>{lines.map((line, i) => (
        <View key={i} style={styles.line}>
          {showLineNumbers && <Text style={styles.lineNum}>{i + 1}</Text>}
          <Text style={styles.lineCode}>{line}</Text>
        </View>
      ))}</View></ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { backgroundColor: '#1e293b', borderRadius: 8, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#0f172a' },
  language: { fontSize: 12, color: '#64748b', textTransform: 'uppercase' },
  copyButton: { fontSize: 12, color: '#94a3b8' },
  codeArea: { padding: 12 },
  line: { flexDirection: 'row' },
  lineNum: { width: 32, fontSize: 13, color: '#475569', fontFamily: 'monospace', textAlign: 'right', marginRight: 12 },
  lineCode: { fontSize: 13, color: '#e2e8f0', fontFamily: 'monospace' },
});

CodeBlock.displayName = 'CodeBlock';
export default CodeBlock;
