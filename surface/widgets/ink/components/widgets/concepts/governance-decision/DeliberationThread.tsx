/* ---------------------------------------------------------------------------
 * DeliberationThread — Ink (terminal) implementation
 * Threaded discussion view for governance deliberation
 * See widget spec: deliberation-thread.widget
 * ------------------------------------------------------------------------- */

export type DeliberationThreadState = 'viewing' | 'composing' | 'entrySelected';
export type DeliberationThreadEvent =
  | { type: 'REPLY_TO'; entryId: string }
  | { type: 'SELECT_ENTRY'; entryId: string }
  | { type: 'SEND' }
  | { type: 'CANCEL' }
  | { type: 'DESELECT' };

export interface DeliberationThreadMachineContext {
  state: DeliberationThreadState;
  replyTargetId: string | null;
  selectedEntryId: string | null;
}

export function deliberationThreadReducer(
  ctx: DeliberationThreadMachineContext,
  event: DeliberationThreadEvent,
): DeliberationThreadMachineContext {
  switch (ctx.state) {
    case 'viewing':
      if (event.type === 'REPLY_TO')
        return { state: 'composing', replyTargetId: event.entryId, selectedEntryId: null };
      if (event.type === 'SELECT_ENTRY')
        return { state: 'entrySelected', replyTargetId: null, selectedEntryId: event.entryId };
      return ctx;
    case 'composing':
      if (event.type === 'SEND')
        return { state: 'viewing', replyTargetId: null, selectedEntryId: null };
      if (event.type === 'CANCEL')
        return { state: 'viewing', replyTargetId: null, selectedEntryId: null };
      return ctx;
    case 'entrySelected':
      if (event.type === 'DESELECT')
        return { state: 'viewing', replyTargetId: null, selectedEntryId: null };
      if (event.type === 'REPLY_TO')
        return { state: 'composing', replyTargetId: event.entryId, selectedEntryId: null };
      return ctx;
    default:
      return ctx;
  }
}

import React, { useReducer, useState, useMemo, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type ArgumentTag = 'for' | 'against' | 'question' | 'amendment';
export type SortMode = 'time' | 'tag' | 'relevance';

const TAG_COLORS: Record<ArgumentTag, string> = {
  for: 'green',
  against: 'red',
  question: 'blue',
  amendment: 'yellow',
};

const TAG_LABELS: Record<ArgumentTag, string> = {
  for: 'For',
  against: 'Against',
  question: 'Question',
  amendment: 'Amendment',
};

export interface DeliberationEntry {
  id: string;
  author: string;
  avatar?: string;
  content: string;
  timestamp: string;
  tag: ArgumentTag;
  parentId?: string | null;
  relevance?: number;
}

interface EntryNode {
  entry: DeliberationEntry;
  children: EntryNode[];
  depth: number;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function buildTree(entries: DeliberationEntry[], maxNesting: number): EntryNode[] {
  const byId = new Map<string, EntryNode>();
  const roots: EntryNode[] = [];

  for (const entry of entries) {
    byId.set(entry.id, { entry, children: [], depth: 0 });
  }

  for (const entry of entries) {
    const node = byId.get(entry.id)!;
    if (entry.parentId && byId.has(entry.parentId)) {
      const parent = byId.get(entry.parentId)!;
      node.depth = Math.min(parent.depth + 1, maxNesting);
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function sortEntries(entries: DeliberationEntry[], mode: SortMode): DeliberationEntry[] {
  const sorted = [...entries];
  switch (mode) {
    case 'time':
      return sorted.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    case 'tag': {
      const order: Record<ArgumentTag, number> = { for: 0, against: 1, question: 2, amendment: 3 };
      return sorted.sort((a, b) => order[a.tag] - order[b.tag]);
    }
    case 'relevance':
      return sorted.sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0));
    default:
      return sorted;
  }
}

function flattenTree(nodes: EntryNode[], collapsedIds: Set<string>): EntryNode[] {
  const result: EntryNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (!collapsedIds.has(node.entry.id) && node.children.length > 0) {
      result.push(...flattenTree(node.children, collapsedIds));
    }
  }
  return result;
}

function computeSentiment(entries: DeliberationEntry[]): { forCount: number; againstCount: number; ratio: number } {
  let forCount = 0;
  let againstCount = 0;
  for (const e of entries) {
    if (e.tag === 'for') forCount++;
    else if (e.tag === 'against') againstCount++;
  }
  const total = forCount + againstCount;
  return { forCount, againstCount, ratio: total > 0 ? forCount / total : 0.5 };
}

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface DeliberationThreadProps {
  entries: DeliberationEntry[];
  status: string;
  summary?: string;
  showSentiment?: boolean;
  showTags?: boolean;
  maxNesting?: number;
  sortMode?: SortMode;
  onReply?: (parentId: string, content: string) => void;
  onSortChange?: (mode: SortMode) => void;
  onEntrySelect?: (entryId: string) => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const INITIAL_CTX: DeliberationThreadMachineContext = {
  state: 'viewing',
  replyTargetId: null,
  selectedEntryId: null,
};

export function DeliberationThread({
  entries,
  status,
  summary,
  showSentiment = true,
  showTags = true,
  maxNesting = 3,
  sortMode: controlledSortMode,
  onReply,
  onSortChange,
  onEntrySelect,
}: DeliberationThreadProps) {
  const [ctx, send] = useReducer(deliberationThreadReducer, INITIAL_CTX);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [focusIndex, setFocusIndex] = useState(0);
  const [internalSortMode, setInternalSortMode] = useState<SortMode>('time');

  const sortMode = controlledSortMode ?? internalSortMode;

  const sortedEntries = useMemo(() => sortEntries(entries, sortMode), [entries, sortMode]);
  const tree = useMemo(() => buildTree(sortedEntries, maxNesting), [sortedEntries, maxNesting]);
  const flatNodes = useMemo(() => flattenTree(tree, collapsedIds), [tree, collapsedIds]);
  const sentiment = useMemo(() => computeSentiment(entries), [entries]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useInput((input, key) => {
    if (ctx.state === 'composing') {
      if (key.escape) {
        send({ type: 'CANCEL' });
      }
      return;
    }

    if (key.downArrow) {
      setFocusIndex((i) => Math.min(i + 1, flatNodes.length - 1));
    } else if (key.upArrow) {
      setFocusIndex((i) => Math.max(i - 1, 0));
    } else if (key.rightArrow) {
      const node = flatNodes[focusIndex];
      if (node && collapsedIds.has(node.entry.id)) {
        toggleCollapse(node.entry.id);
      }
    } else if (key.leftArrow) {
      const node = flatNodes[focusIndex];
      if (node && !collapsedIds.has(node.entry.id) && node.children.length > 0) {
        toggleCollapse(node.entry.id);
      }
    } else if (key.return) {
      const node = flatNodes[focusIndex];
      if (node) {
        send({ type: 'REPLY_TO', entryId: node.entry.id });
      }
    } else if (input === 'r') {
      const node = flatNodes[focusIndex];
      if (node) {
        send({ type: 'REPLY_TO', entryId: node.entry.id });
      }
    } else if (key.escape) {
      if (ctx.state === 'entrySelected') {
        send({ type: 'DESELECT' });
      }
    } else if (input === 's') {
      const modes: SortMode[] = ['time', 'tag', 'relevance'];
      const idx = modes.indexOf(sortMode);
      const next = modes[(idx + 1) % modes.length];
      setInternalSortMode(next);
      onSortChange?.(next);
    } else if (key.return && ctx.state === 'viewing') {
      const node = flatNodes[focusIndex];
      if (node) {
        send({ type: 'SELECT_ENTRY', entryId: node.entry.id });
        onEntrySelect?.(node.entry.id);
      }
    }
  });

  // Build sentiment bar using block characters
  const sentimentBar = useMemo(() => {
    const width = 30;
    const forWidth = Math.round(sentiment.ratio * width);
    const againstWidth = width - forWidth;
    return { forBar: '\u2588'.repeat(forWidth), againstBar: '\u2588'.repeat(againstWidth) };
  }, [sentiment]);

  function renderEntryNode(node: EntryNode, index: number): React.ReactNode {
    const { entry } = node;
    const isFocused = flatNodes[focusIndex]?.entry.id === entry.id;
    const isSelected = ctx.selectedEntryId === entry.id;
    const isReplyTarget = ctx.replyTargetId === entry.id;
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsedIds.has(entry.id);
    const indent = '  '.repeat(node.depth);
    const treeChar = node.depth > 0 ? '\u2514\u2500 ' : '';

    return (
      <Box key={entry.id} flexDirection="column">
        <Box>
          <Text dimColor>{indent}{treeChar}</Text>
          <Text bold={isFocused} inverse={isSelected}>
            {isFocused ? '\u25B6 ' : '  '}
          </Text>
          <Text>{entry.author.charAt(0).toUpperCase()}</Text>
          <Text bold> {entry.author} </Text>
          {showTags && (
            <Text color={TAG_COLORS[entry.tag]}>[{TAG_LABELS[entry.tag]}]</Text>
          )}
          <Text dimColor> {formatTimestamp(entry.timestamp)}</Text>
        </Box>
        <Box>
          <Text dimColor>{indent}{node.depth > 0 ? '   ' : ''}</Text>
          <Text>   {entry.content}</Text>
        </Box>
        {hasChildren && (
          <Box>
            <Text dimColor>{indent}   </Text>
            <Text dimColor>
              {isCollapsed
                ? `\u25B6 ${node.children.length} repl${node.children.length === 1 ? 'y' : 'ies'} (right arrow to expand)`
                : `\u25BC replies (left arrow to collapse)`}
            </Text>
          </Box>
        )}
        {ctx.state === 'composing' && isReplyTarget && (
          <Box>
            <Text dimColor>{indent}   </Text>
            <Text color="cyan">\u270E Replying to {entry.author}... (Esc to cancel)</Text>
          </Box>
        )}
        {hasChildren && !isCollapsed && (
          <Box flexDirection="column">
            {node.children.map((child, childIdx) => renderEntryNode(child, childIdx))}
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round">
      {/* Header */}
      <Box>
        <Text bold>Deliberation Thread</Text>
        <Text> </Text>
        <Text color={status === 'open' ? 'green' : status === 'closed' ? 'red' : 'yellow'}>
          [{status.toUpperCase()}]
        </Text>
        <Text dimColor> Sort: {sortMode} (s to cycle)</Text>
      </Box>

      {summary && (
        <Box>
          <Text dimColor>{summary}</Text>
        </Box>
      )}

      {/* Sentiment bar */}
      {showSentiment && (
        <Box>
          <Text color="green">{sentimentBar.forBar}</Text>
          <Text color="red">{sentimentBar.againstBar}</Text>
          <Text dimColor> {sentiment.forCount} for / {sentiment.againstCount} against</Text>
        </Box>
      )}

      <Box><Text dimColor>{'\u2500'.repeat(50)}</Text></Box>

      {/* Entry list */}
      {flatNodes.length === 0 ? (
        <Box><Text dimColor italic>No contributions yet.</Text></Box>
      ) : (
        <Box flexDirection="column">
          {tree.map((node, idx) => renderEntryNode(node, idx))}
        </Box>
      )}

      {/* Navigation hints */}
      <Box><Text dimColor>{'\u2500'.repeat(50)}</Text></Box>
      <Box>
        <Text dimColor>\u2191\u2193 navigate  \u2190\u2192 collapse/expand  r reply  s sort  Esc deselect</Text>
      </Box>
    </Box>
  );
}

export default DeliberationThread;
