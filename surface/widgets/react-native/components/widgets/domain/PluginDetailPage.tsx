import React, { type ReactNode } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet, type ViewStyle } from 'react-native';

export interface PluginScreenshot { url: string; alt?: string; }
export interface PluginReview { author: string; rating: number; body: string; }
export interface ChangelogEntry { version: string; date: string; notes: string; }

export interface PluginDetailPageProps {
  name: string; description?: string; version?: string; author?: string;
  icon?: ReactNode; screenshots?: PluginScreenshot[]; reviews?: PluginReview[];
  changelog?: ChangelogEntry[];
  onInstall?: () => void; onUninstall?: () => void;
  style?: ViewStyle;
}

export const PluginDetailPage: React.FC<PluginDetailPageProps> = ({
  name, description, version, author, icon, screenshots = [], reviews = [], changelog = [],
  onInstall, onUninstall, style,
}) => (
  <ScrollView style={[styles.root, style]}>
    <View style={styles.header}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <View style={styles.meta}><Text style={styles.name}>{name}</Text>{version && <Text style={styles.version}>v{version}</Text>}{author && <Text style={styles.author}>by {author}</Text>}</View>
    </View>
    {description && <Text style={styles.description}>{description}</Text>}
    {onInstall && <Pressable onPress={onInstall} style={styles.installButton}><Text style={styles.installText}>Install</Text></Pressable>}
    {screenshots.length > 0 && <ScrollView horizontal style={styles.screenshots}>{screenshots.map((s, i) => (<Image key={i} source={{ uri: s.url }} style={styles.screenshot} accessibilityLabel={s.alt || 'Screenshot'} />))}</ScrollView>}
    {changelog.length > 0 && (<View style={styles.section}><Text style={styles.sectionTitle}>Changelog</Text>{changelog.map(c => (<View key={c.version} style={styles.changelogItem}><Text style={styles.changelogVersion}>{c.version} - {c.date}</Text><Text style={styles.changelogNotes}>{c.notes}</Text></View>))}</View>)}
  </ScrollView>
);

const styles = StyleSheet.create({
  root: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  icon: { marginRight: 12 },
  meta: {},
  name: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  version: { fontSize: 13, color: '#64748b' },
  author: { fontSize: 13, color: '#94a3b8' },
  description: { fontSize: 14, color: '#475569', lineHeight: 22, marginBottom: 16 },
  installButton: { backgroundColor: '#3b82f6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 16 },
  installText: { fontSize: 15, color: '#fff', fontWeight: '600' },
  screenshots: { marginBottom: 16 },
  screenshot: { width: 200, height: 150, borderRadius: 8, marginRight: 8 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
  changelogItem: { marginBottom: 8 },
  changelogVersion: { fontSize: 13, fontWeight: '500', color: '#1e293b' },
  changelogNotes: { fontSize: 13, color: '#475569' },
});

PluginDetailPage.displayName = 'PluginDetailPage';
export default PluginDetailPage;
