export type ProposalCardState = 'idle' | 'hovered' | 'focused' | 'navigating';
export type ProposalCardEvent = | { type: 'HOVER' } | { type: 'FOCUS' } | { type: 'CLICK' } | { type: 'UNHOVER' } | { type: 'BLUR' } | { type: 'ENTER' } | { type: 'NAVIGATE_COMPLETE' };

export function proposalCardReducer(state: ProposalCardState, event: ProposalCardEvent): ProposalCardState {
  switch (state) {
    case 'idle': if (event.type === 'HOVER') return 'hovered'; if (event.type === 'FOCUS') return 'focused'; if (event.type === 'CLICK') return 'navigating'; return state;
    case 'hovered': if (event.type === 'UNHOVER') return 'idle'; return state;
    case 'focused': if (event.type === 'BLUR') return 'idle'; if (event.type === 'CLICK' || event.type === 'ENTER') return 'navigating'; return state;
    case 'navigating': if (event.type === 'NAVIGATE_COMPLETE') return 'idle'; return state;
    default: return state;
  }
}

import React, { forwardRef, useReducer, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export interface ProposalCardProps {
  title: string; description: string; author: string; status: string; timestamp: string;
  variant?: 'full' | 'compact' | 'minimal'; showVoteBar?: boolean; showQuorum?: boolean; truncateDescription?: number;
  voteFor?: number; voteAgainst?: number; voteTotal?: number; quorumThreshold?: number;
  onPress?: () => void;
}

const STATUS_COLORS: Record<string, string> = { active: '#22c55e', pending: '#eab308', closed: '#6b7280', executed: '#3b82f6', defeated: '#ef4444' };

const ProposalCard = forwardRef<View, ProposalCardProps>(function ProposalCard(
  { title, description, author, status, timestamp, variant = 'full', showVoteBar = false, showQuorum = false,
    truncateDescription = 120, voteFor = 0, voteAgainst = 0, voteTotal = 0, quorumThreshold, onPress }, ref,
) {
  const [state, send] = useReducer(proposalCardReducer, 'idle');
  const handlePress = useCallback(() => { send({ type: 'CLICK' }); onPress?.(); setTimeout(() => send({ type: 'NAVIGATE_COMPLETE' }), 300); }, [onPress]);
  const desc = description.length > truncateDescription ? description.slice(0, truncateDescription) + '...' : description;
  const isCompact = variant === 'compact' || variant === 'minimal';
  const forPct = voteTotal > 0 ? (voteFor / voteTotal) * 100 : 0;

  return (
    <Pressable ref={ref} testID="proposal-card" onPress={handlePress} onPressIn={() => send({ type: 'HOVER' })} onPressOut={() => send({ type: 'UNHOVER' })}
      accessibilityRole="button" accessibilityLabel={`Proposal: ${title}, status ${status}`} style={[st.root, isCompact && st.compact]}>
      <View style={st.header}>
        <View style={[st.statusDot, { backgroundColor: STATUS_COLORS[status] ?? '#6b7280' }]} />
        <Text style={st.statusText}>{status}</Text>
        <Text style={st.ts}>{new Date(timestamp).toLocaleDateString()}</Text>
      </View>
      <Text style={st.title}>{title}</Text>
      {variant !== 'minimal' && <Text style={st.desc} numberOfLines={isCompact ? 2 : undefined}>{desc}</Text>}
      <Text style={st.author}>by {author}</Text>
      {showVoteBar && voteTotal > 0 && (
        <View style={st.voteBar}><View style={[st.voteFill, { width: `${forPct}%` as any }]} />{showQuorum && quorumThreshold != null && (
          <View style={[st.quorumLine, { left: `${(quorumThreshold / voteTotal) * 100}%` as any }]} />
        )}</View>
      )}
    </Pressable>);
});

const st = StyleSheet.create({
  root: { padding: 12, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, backgroundColor: '#fff' },
  compact: { padding: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 }, statusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  ts: { fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }, title: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  desc: { fontSize: 13, color: '#4b5563', lineHeight: 20, marginBottom: 4 }, author: { fontSize: 12, color: '#6b7280' },
  voteBar: { height: 6, backgroundColor: '#ef4444', borderRadius: 3, marginTop: 8, overflow: 'hidden', position: 'relative' },
  voteFill: { height: '100%', backgroundColor: '#22c55e', borderRadius: 3 },
  quorumLine: { position: 'absolute', top: -2, width: 2, height: 10, backgroundColor: '#1f2937' },
});

ProposalCard.displayName = 'ProposalCard';
export { ProposalCard };
export default ProposalCard;
