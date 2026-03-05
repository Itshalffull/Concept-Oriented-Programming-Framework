export type DeliberationThreadState = 'viewing' | 'composing' | 'entrySelected';
export type DeliberationThreadEvent =
  | { type: 'REPLY_TO'; entryId: string }
  | { type: 'SELECT_ENTRY'; entryId: string }
  | { type: 'SEND' }
  | { type: 'CANCEL' }
  | { type: 'DESELECT' };

export interface DeliberationThreadMachineContext { state: DeliberationThreadState; replyTargetId: string | null; selectedEntryId: string | null; }

export function deliberationThreadReducer(ctx: DeliberationThreadMachineContext, event: DeliberationThreadEvent): DeliberationThreadMachineContext {
  switch (ctx.state) {
    case 'viewing':
      if (event.type === 'REPLY_TO') return { state: 'composing', replyTargetId: event.entryId, selectedEntryId: null };
      if (event.type === 'SELECT_ENTRY') return { state: 'entrySelected', replyTargetId: null, selectedEntryId: event.entryId };
      return ctx;
    case 'composing':
      if (event.type === 'SEND' || event.type === 'CANCEL') return { state: 'viewing', replyTargetId: null, selectedEntryId: null };
      return ctx;
    case 'entrySelected':
      if (event.type === 'DESELECT') return { state: 'viewing', replyTargetId: null, selectedEntryId: null };
      if (event.type === 'REPLY_TO') return { state: 'composing', replyTargetId: event.entryId, selectedEntryId: null };
      return ctx;
    default: return ctx;
  }
}

import React, { forwardRef, useCallback, useMemo, useReducer, useState } from 'react';
import { View, Text, Pressable, TextInput, FlatList, StyleSheet } from 'react-native';

export type ArgumentTag = 'for' | 'against' | 'question' | 'amendment';
const TAG_COLORS: Record<ArgumentTag, string> = { for: '#22c55e', against: '#ef4444', question: '#3b82f6', amendment: '#eab308' };
const TAG_LABELS: Record<ArgumentTag, string> = { for: 'For', against: 'Against', question: 'Question', amendment: 'Amendment' };

export interface DeliberationEntry { id: string; author: string; avatar?: string; content: string; timestamp: string; tag: ArgumentTag; parentId?: string | null; relevance?: number; }

export interface DeliberationThreadProps {
  entries: DeliberationEntry[]; status?: string; summary?: string; showSentiment?: boolean; showTags?: boolean; maxNesting?: number;
  onSend?: (content: string, parentId?: string) => void; onSelectEntry?: (id: string | undefined) => void;
}

const DeliberationThread = forwardRef<View, DeliberationThreadProps>(function DeliberationThread(
  { entries, status = 'active', summary, showSentiment = false, showTags = true, onSend, onSelectEntry }, ref,
) {
  const [ctx, send] = useReducer(deliberationThreadReducer, { state: 'viewing', replyTargetId: null, selectedEntryId: null });
  const [composeText, setComposeText] = useState('');
  const entryMap = useMemo(() => { const m = new Map<string, DeliberationEntry>(); for (const e of entries) m.set(e.id, e); return m; }, [entries]);
  const handleSend = useCallback(() => { if (composeText.trim()) { onSend?.(composeText.trim(), ctx.replyTargetId ?? undefined); setComposeText(''); send({ type: 'SEND' }); } }, [composeText, ctx.replyTargetId, onSend]);
  const selectedEntry = ctx.selectedEntryId ? entryMap.get(ctx.selectedEntryId) : undefined;

  return (
    <View ref={ref} testID="deliberation-thread" accessibilityRole="list" accessibilityLabel="Deliberation thread" style={s.root}>
      <View style={s.header}><Text style={s.title}>Deliberation ({entries.length})</Text><Text style={s.badge}>{status}</Text></View>
      {summary && <Text style={s.summary}>{summary}</Text>}
      {showSentiment && (() => { let f = 0, a = 0; for (const e of entries) { if (e.tag === 'for') f++; else if (e.tag === 'against') a++; } const r = (f+a) > 0 ? f/(f+a) : 0.5; return <View style={s.sentBar}><View style={[s.sentFill, { width: `${r*100}%` as any }]} /></View>; })()}
      <FlatList data={entries} keyExtractor={(i) => i.id} style={s.list} renderItem={({ item }) => {
        const sel = ctx.selectedEntryId === item.id;
        return (
          <Pressable onPress={() => { send({ type: 'SELECT_ENTRY', entryId: item.id }); onSelectEntry?.(item.id); }} accessibilityRole="button" accessibilityState={{ selected: sel }} style={[s.entry, sel && s.entrySel]}>
            <View style={s.entryHead}><View style={[s.av, { backgroundColor: TAG_COLORS[item.tag]+'33' }]}><Text style={s.avT}>{item.author.charAt(0)}</Text></View>
              <Text style={s.author}>{item.author}</Text>{showTags && <Text style={{ fontSize: 11, fontWeight: '600', color: TAG_COLORS[item.tag] }}>{TAG_LABELS[item.tag]}</Text>}
              <Text style={s.ts}>{new Date(item.timestamp).toLocaleTimeString()}</Text></View>
            <Text style={s.content}>{item.content}</Text>
            <Pressable onPress={() => send({ type: 'REPLY_TO', entryId: item.id })} accessibilityRole="button"><Text style={s.reply}>Reply</Text></Pressable>
          </Pressable>);
      }} />
      {ctx.state === 'composing' && (
        <View style={s.compose}>{ctx.replyTargetId && <Text style={s.replyTo}>Replying to {entryMap.get(ctx.replyTargetId)?.author}</Text>}
          <TextInput value={composeText} onChangeText={setComposeText} placeholder="Type your argument..." multiline style={s.input} accessibilityLabel="Compose reply" />
          <View style={s.btns}><Pressable onPress={handleSend} accessibilityRole="button" style={s.sendBtn}><Text style={s.sendT}>Send</Text></Pressable>
            <Pressable onPress={() => { setComposeText(''); send({ type: 'CANCEL' }); }} accessibilityRole="button"><Text style={s.cancelT}>Cancel</Text></Pressable></View></View>)}
      {ctx.state === 'entrySelected' && selectedEntry && (
        <View style={s.detail}><View style={s.dHead}><Text style={s.dTitle}>{selectedEntry.author}</Text>
          <Pressable onPress={() => { send({ type: 'DESELECT' }); onSelectEntry?.(undefined); }}><Text>{'\u2715'}</Text></Pressable></View>
          <Text style={{ fontSize: 11, fontWeight: '600', color: TAG_COLORS[selectedEntry.tag] }}>{TAG_LABELS[selectedEntry.tag]}</Text>
          <Text style={s.dContent}>{selectedEntry.content}</Text><Text style={s.dTs}>{new Date(selectedEntry.timestamp).toLocaleString()}</Text></View>)}
    </View>);
});

const s = StyleSheet.create({
  root: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  title: { fontSize: 14, fontWeight: '600' }, badge: { fontSize: 12, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4 },
  summary: { fontSize: 13, padding: 8, color: '#6b7280' }, sentBar: { height: 4, backgroundColor: '#ef4444', borderRadius: 2, marginHorizontal: 8, marginBottom: 4, overflow: 'hidden' },
  sentFill: { height: '100%', backgroundColor: '#22c55e' }, list: { flex: 1 }, entry: { padding: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }, entrySel: { backgroundColor: '#dbeafe' },
  entryHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }, av: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avT: { fontSize: 12, fontWeight: '600' }, author: { fontSize: 13, fontWeight: '600', flex: 1 }, ts: { fontSize: 11, color: '#9ca3af' },
  content: { fontSize: 13, lineHeight: 20 }, reply: { fontSize: 12, color: '#6366f1', marginTop: 4 },
  compose: { padding: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb' }, replyTo: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4, padding: 8, minHeight: 60, fontSize: 13, textAlignVertical: 'top' },
  btns: { flexDirection: 'row', gap: 8, marginTop: 8 }, sendBtn: { backgroundColor: '#6366f1', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 4 },
  sendT: { color: '#fff', fontWeight: '600', fontSize: 13 }, cancelT: { color: '#6b7280', fontSize: 13, paddingVertical: 6 },
  detail: { padding: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' }, dHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dTitle: { fontSize: 14, fontWeight: '600' }, dContent: { fontSize: 13, lineHeight: 20, marginVertical: 8 }, dTs: { fontSize: 12, color: '#9ca3af' },
});

DeliberationThread.displayName = 'DeliberationThread';
export { DeliberationThread };
export default DeliberationThread;
