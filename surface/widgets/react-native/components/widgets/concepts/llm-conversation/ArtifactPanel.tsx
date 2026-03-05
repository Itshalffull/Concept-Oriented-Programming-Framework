export type ArtifactPanelState = 'open' | 'copied' | 'fullscreen' | 'closed';
export type ArtifactPanelEvent =
  | { type: 'COPY' }
  | { type: 'FULLSCREEN' }
  | { type: 'CLOSE' }
  | { type: 'VERSION_CHANGE' }
  | { type: 'COPY_TIMEOUT' }
  | { type: 'EXIT_FULLSCREEN' }
  | { type: 'OPEN' };

export function artifactPanelReducer(state: ArtifactPanelState, event: ArtifactPanelEvent): ArtifactPanelState {
  switch (state) {
    case 'open':
      if (event.type === 'COPY') return 'copied';
      if (event.type === 'FULLSCREEN') return 'fullscreen';
      if (event.type === 'CLOSE') return 'closed';
      if (event.type === 'VERSION_CHANGE') return 'open';
      return state;
    case 'copied':
      if (event.type === 'COPY_TIMEOUT') return 'open';
      return state;
    case 'fullscreen':
      if (event.type === 'EXIT_FULLSCREEN') return 'open';
      if (event.type === 'CLOSE') return 'closed';
      return state;
    case 'closed':
      if (event.type === 'OPEN') return 'open';
      return state;
    default:
      return state;
  }
}

import React, { forwardRef, useCallback, useEffect, useRef, useReducer, type ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, Image, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';

const TYPE_ICONS: Record<string, string> = { code: '\uD83D\uDCBB', document: '\uD83D\uDCC4', image: '\uD83D\uDDBC', html: '\uD83C\uDF10' };
const TYPE_LABELS: Record<string, string> = { code: 'Code', document: 'Document', image: 'Image', html: 'HTML' };

export interface ArtifactPanelProps {
  content: string;
  artifactType: 'code' | 'document' | 'image' | 'html';
  title: string;
  language?: string;
  showVersions?: boolean;
  currentVersion?: number;
  totalVersions?: number;
  onVersionChange?: (version: number) => void;
  onClose?: () => void;
  onCopy?: () => void;
  onDownload?: () => void;
  children?: ReactNode;
}

const ArtifactPanel = forwardRef<View, ArtifactPanelProps>(function ArtifactPanel(
  { content, artifactType, title, language, showVersions = true, currentVersion = 1, totalVersions = 1,
    onVersionChange, onClose, onCopy, onDownload, children },
  ref,
) {
  const [state, send] = useReducer(artifactPanelReducer, 'open');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (state === 'copied') {
      timerRef.current = setTimeout(() => send({ type: 'COPY_TIMEOUT' }), 2000);
      return () => clearTimeout(timerRef.current);
    }
  }, [state]);

  useEffect(() => { if (state === 'closed') onClose?.(); }, [state, onClose]);

  const handleCopy = useCallback(async () => {
    try { await Clipboard.setStringAsync(content); } catch { /* noop */ }
    send({ type: 'COPY' });
    onCopy?.();
  }, [content, onCopy]);

  const handleVersionPrev = useCallback(() => {
    if (currentVersion > 1) { send({ type: 'VERSION_CHANGE' }); onVersionChange?.(currentVersion - 1); }
  }, [currentVersion, onVersionChange]);

  const handleVersionNext = useCallback(() => {
    if (currentVersion < totalVersions) { send({ type: 'VERSION_CHANGE' }); onVersionChange?.(currentVersion + 1); }
  }, [currentVersion, totalVersions, onVersionChange]);

  if (state === 'closed') return null;

  const typeIcon = TYPE_ICONS[artifactType] ?? '';
  const typeLabel = TYPE_LABELS[artifactType] ?? artifactType;
  const showVersionBar = showVersions && totalVersions > 1;

  const renderContent = () => {
    if (children) return children;
    switch (artifactType) {
      case 'code':
        return (
          <View style={st.codeBlock}>
            {language && <Text style={st.langLabel}>{language}</Text>}
            <ScrollView horizontal><Text style={st.codeText}>{content}</Text></ScrollView>
          </View>
        );
      case 'document':
        return <Text style={st.docText}>{content}</Text>;
      case 'image':
        return <Image source={{ uri: content }} style={st.image} accessibilityLabel={title} resizeMode="contain" />;
      case 'html':
        return (
          <View style={st.htmlBlock}>
            <Text style={st.htmlNotice}>HTML preview not available in native. Raw source shown below.</Text>
            <ScrollView horizontal><Text style={st.codeText}>{content}</Text></ScrollView>
          </View>
        );
      default:
        return <Text style={st.docText}>{content}</Text>;
    }
  };

  return (
    <View ref={ref} testID="artifact-panel" accessibilityRole="none" accessibilityLabel={`Artifact: ${title}`} style={st.root}>
      <View style={st.header}>
        <Text style={st.typeBadge}>{typeIcon} {typeLabel}</Text>
        <Text style={st.title} numberOfLines={1}>{title}</Text>
        <View style={st.toolbar}>
          <Pressable onPress={handleCopy} accessibilityRole="button"
            accessibilityLabel={state === 'copied' ? 'Copied to clipboard' : 'Copy artifact content'}>
            <Text style={st.toolbarBtn}>{state === 'copied' ? 'Copied!' : 'Copy'}</Text>
          </Pressable>
          {onDownload && (
            <Pressable onPress={onDownload} accessibilityRole="button" accessibilityLabel="Download artifact">
              <Text style={st.toolbarBtn}>Download</Text>
            </Pressable>
          )}
          <Pressable onPress={() => state === 'fullscreen' ? send({ type: 'EXIT_FULLSCREEN' }) : send({ type: 'FULLSCREEN' })}
            accessibilityRole="button" accessibilityLabel={state === 'fullscreen' ? 'Exit fullscreen' : 'Fullscreen'}>
            <Text style={st.toolbarBtn}>{state === 'fullscreen' ? 'Exit FS' : 'Fullscreen'}</Text>
          </Pressable>
          <Pressable onPress={() => send({ type: 'CLOSE' })} accessibilityRole="button" accessibilityLabel="Close artifact panel">
            <Text style={st.toolbarBtn}>Close</Text>
          </Pressable>
        </View>
      </View>
      {showVersionBar && (
        <View style={st.versionBar}>
          <Pressable onPress={handleVersionPrev} accessibilityRole="button" accessibilityLabel="Previous version" disabled={currentVersion <= 1}>
            <Text style={[st.versionArrow, currentVersion <= 1 && st.disabled]}>{'\u2039'}</Text>
          </Pressable>
          <Text style={st.versionText}>Version {currentVersion} of {totalVersions}</Text>
          <Pressable onPress={handleVersionNext} accessibilityRole="button" accessibilityLabel="Next version" disabled={currentVersion >= totalVersions}>
            <Text style={[st.versionArrow, currentVersion >= totalVersions && st.disabled]}>{'\u203A'}</Text>
          </Pressable>
        </View>
      )}
      <ScrollView style={st.content}>{renderContent()}</ScrollView>
    </View>
  );
});

const st = StyleSheet.create({
  root: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  typeBadge: { fontSize: 12 },
  title: { flex: 1, fontWeight: '600', fontSize: 14 },
  toolbar: { flexDirection: 'row', gap: 8 },
  toolbarBtn: { fontSize: 12, color: '#6366f1', fontWeight: '600' },
  versionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  versionArrow: { fontSize: 18, color: '#6366f1', paddingHorizontal: 8 },
  versionText: { fontSize: 12 },
  disabled: { color: '#d1d5db' },
  content: { flex: 1 },
  codeBlock: { padding: 12 },
  langLabel: { fontSize: 11, textTransform: 'uppercase', color: '#9ca3af', marginBottom: 8 },
  codeText: { fontSize: 13, fontFamily: 'monospace', lineHeight: 20 },
  docText: { fontSize: 14, lineHeight: 22, padding: 16 },
  image: { width: '100%', height: 300 },
  htmlBlock: { padding: 12, gap: 8 },
  htmlNotice: { fontSize: 13, color: '#6b7280', fontStyle: 'italic' },
});

ArtifactPanel.displayName = 'ArtifactPanel';
export { ArtifactPanel };
export default ArtifactPanel;
