import {
  StackLayout,
  Label,
  Button,
  TextField,
  ScrollView,
  Color,
  View,
} from '@nativescript/core';

export type DeliberationThreadState = 'viewing' | 'composing' | 'entrySelected';
export type DeliberationThreadEvent =
  | { type: 'REPLY_TO' }
  | { type: 'SELECT_ENTRY' }
  | { type: 'SEND' }
  | { type: 'CANCEL' }
  | { type: 'DESELECT' };

export function deliberationThreadReducer(state: DeliberationThreadState, event: DeliberationThreadEvent): DeliberationThreadState {
  switch (state) {
    case 'viewing':
      if (event.type === 'REPLY_TO') return 'composing';
      if (event.type === 'SELECT_ENTRY') return 'entrySelected';
      return state;
    case 'composing':
      if (event.type === 'SEND') return 'viewing';
      if (event.type === 'CANCEL') return 'viewing';
      return state;
    case 'entrySelected':
      if (event.type === 'DESELECT') return 'viewing';
      return state;
    default:
      return state;
  }
}

export type ArgumentTag = 'for' | 'against' | 'question' | 'amendment';
export type SortMode = 'time' | 'tag' | 'relevance';

const TAG_COLORS: Record<ArgumentTag, string> = {
  for: '#22c55e',
  against: '#ef4444',
  question: '#3b82f6',
  amendment: '#eab308',
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

export function createDeliberationThread(props: DeliberationThreadProps): { view: View; dispose: () => void } {
  let state: DeliberationThreadState = 'viewing';
  let replyTargetId: string | null = null;
  let selectedEntryId: string | null = null;
  let replyText = '';
  const disposers: (() => void)[] = [];

  function send(event: DeliberationThreadEvent) {
    state = deliberationThreadReducer(state, event);
    render();
  }

  const root = new StackLayout();
  root.className = 'clef-deliberation-thread';
  root.automationText = 'Deliberation thread';

  function buildTree(entries: DeliberationEntry[], parentId: string | null | undefined, depth: number): DeliberationEntry[] {
    return entries.filter(e => (e.parentId ?? null) === parentId);
  }

  function render() {
    root.removeChildren();

    // Header
    if (props.summary) {
      const summaryLabel = new Label();
      summaryLabel.text = props.summary;
      summaryLabel.fontWeight = 'bold';
      summaryLabel.fontSize = 14;
      summaryLabel.padding = '8 12';
      root.addChild(summaryLabel);
    }

    const statusLabel = new Label();
    statusLabel.text = `Status: ${props.status}`;
    statusLabel.fontSize = 12;
    statusLabel.padding = '4 12';
    statusLabel.color = new Color('#6b7280');
    root.addChild(statusLabel);

    // Sentiment bar
    if (props.showSentiment !== false) {
      const forCount = props.entries.filter(e => e.tag === 'for').length;
      const againstCount = props.entries.filter(e => e.tag === 'against').length;
      const total = forCount + againstCount || 1;
      const sentLabel = new Label();
      sentLabel.text = `Sentiment: ${forCount} for / ${againstCount} against (${Math.round(forCount / total * 100)}% for)`;
      sentLabel.fontSize = 12;
      sentLabel.padding = '4 12';
      root.addChild(sentLabel);
    }

    // Entries
    const scroll = new ScrollView();
    const list = new StackLayout();

    function renderEntry(entry: DeliberationEntry, depth: number) {
      const row = new StackLayout();
      row.padding = `6 12 6 ${12 + depth * 16}`;
      if (selectedEntryId === entry.id) row.backgroundColor = new Color('#dbeafe');

      const header = new StackLayout();
      header.orientation = 'horizontal';
      const authorLabel = new Label();
      authorLabel.text = entry.author;
      authorLabel.fontWeight = 'bold';
      authorLabel.fontSize = 13;
      header.addChild(authorLabel);

      if (props.showTags !== false) {
        const tagLabel = new Label();
        tagLabel.text = ` [${entry.tag}]`;
        tagLabel.fontSize = 12;
        tagLabel.color = new Color(TAG_COLORS[entry.tag]);
        header.addChild(tagLabel);
      }

      const tsLabel = new Label();
      tsLabel.text = `  ${entry.timestamp}`;
      tsLabel.fontSize = 11;
      tsLabel.color = new Color('#9ca3af');
      header.addChild(tsLabel);
      row.addChild(header);

      const contentLabel = new Label();
      contentLabel.text = entry.content;
      contentLabel.fontSize = 13;
      contentLabel.textWrap = true;
      contentLabel.padding = '2 0';
      row.addChild(contentLabel);

      // Actions
      const actions = new StackLayout();
      actions.orientation = 'horizontal';
      const replyBtn = new Button();
      replyBtn.text = 'Reply';
      replyBtn.fontSize = 11;
      replyBtn.padding = '2 8';
      const rh = () => { replyTargetId = entry.id; send({ type: 'REPLY_TO' }); };
      replyBtn.on('tap', rh);
      disposers.push(() => replyBtn.off('tap', rh));
      actions.addChild(replyBtn);
      row.addChild(actions);

      const rowHandler = () => {
        selectedEntryId = entry.id;
        send({ type: 'SELECT_ENTRY' });
        props.onEntrySelect?.(entry.id);
      };
      row.on('tap', rowHandler);
      disposers.push(() => row.off('tap', rowHandler));
      row.automationText = `${entry.author}: ${entry.content}`;
      list.addChild(row);

      // Nested replies
      const maxDepth = props.maxNesting ?? 3;
      if (depth < maxDepth) {
        const children = props.entries.filter(e => e.parentId === entry.id);
        for (const child of children) renderEntry(child, depth + 1);
      }
    }

    const topLevel = props.entries.filter(e => !e.parentId);
    for (const entry of topLevel) renderEntry(entry, 0);

    scroll.content = list;
    root.addChild(scroll);

    // Compose area
    if (state === 'composing' && replyTargetId) {
      const compose = new StackLayout();
      compose.padding = '8 12';
      compose.borderTopWidth = 1;
      compose.borderTopColor = new Color('#e5e7eb');

      const replyLabel = new Label();
      const target = props.entries.find(e => e.id === replyTargetId);
      replyLabel.text = `Replying to ${target?.author ?? 'unknown'}`;
      replyLabel.fontSize = 12;
      replyLabel.color = new Color('#6b7280');
      compose.addChild(replyLabel);

      const textField = new TextField();
      textField.hint = 'Type your reply...';
      textField.fontSize = 13;
      const tfHandler = () => { replyText = textField.text ?? ''; };
      textField.on('textChange', tfHandler);
      disposers.push(() => textField.off('textChange', tfHandler));
      compose.addChild(textField);

      const btnRow = new StackLayout();
      btnRow.orientation = 'horizontal';
      const sendBtn = new Button();
      sendBtn.text = 'Send';
      sendBtn.fontSize = 12;
      const sendHandler = () => {
        if (replyTargetId && replyText) props.onReply?.(replyTargetId, replyText);
        replyText = '';
        replyTargetId = null;
        send({ type: 'SEND' });
      };
      sendBtn.on('tap', sendHandler);
      disposers.push(() => sendBtn.off('tap', sendHandler));
      btnRow.addChild(sendBtn);

      const cancelBtn = new Button();
      cancelBtn.text = 'Cancel';
      cancelBtn.fontSize = 12;
      cancelBtn.marginLeft = 8;
      const ch = () => { replyTargetId = null; replyText = ''; send({ type: 'CANCEL' }); };
      cancelBtn.on('tap', ch);
      disposers.push(() => cancelBtn.off('tap', ch));
      btnRow.addChild(cancelBtn);

      compose.addChild(btnRow);
      root.addChild(compose);
    }
  }

  render();

  return {
    view: root,
    dispose() { disposers.forEach(d => d()); },
  };
}

export default createDeliberationThread;
