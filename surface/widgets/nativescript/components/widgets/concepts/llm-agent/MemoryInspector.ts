import { StackLayout, Label, Button, ScrollView, TextField, FlexboxLayout, Progress } from '@nativescript/core';

/* ---------------------------------------------------------------------------
 * MemoryInspector state machine
 * ------------------------------------------------------------------------- */

export type MemoryInspectorState = 'viewing' | 'searching' | 'entrySelected' | 'deleting';
export type MemoryInspectorEvent =
  | { type: 'SWITCH_TAB' }
  | { type: 'SEARCH' }
  | { type: 'SELECT_ENTRY'; id?: string }
  | { type: 'CLEAR' }
  | { type: 'DESELECT' }
  | { type: 'DELETE' }
  | { type: 'CONFIRM' }
  | { type: 'CANCEL' };

export function memoryInspectorReducer(state: MemoryInspectorState, event: MemoryInspectorEvent): MemoryInspectorState {
  switch (state) {
    case 'viewing':
      if (event.type === 'SWITCH_TAB') return 'viewing';
      if (event.type === 'SEARCH') return 'searching';
      if (event.type === 'SELECT_ENTRY') return 'entrySelected';
      return state;
    case 'searching':
      if (event.type === 'CLEAR') return 'viewing';
      if (event.type === 'SELECT_ENTRY') return 'entrySelected';
      return state;
    case 'entrySelected':
      if (event.type === 'DESELECT') return 'viewing';
      if (event.type === 'DELETE') return 'deleting';
      return state;
    case 'deleting':
      if (event.type === 'CONFIRM') return 'viewing';
      if (event.type === 'CANCEL') return 'entrySelected';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type MemoryEntryType = 'fact' | 'instruction' | 'conversation' | 'tool-result';

export interface MemoryEntry {
  id: string;
  type: MemoryEntryType;
  content: string;
  source?: string;
  timestamp?: string;
  relevance?: number;
}

export interface MemoryInspectorProps {
  entries: MemoryEntry[];
  totalTokens: number;
  maxTokens: number;
  activeTab?: 'working' | 'episodic' | 'semantic' | 'procedural';
  showContext?: boolean;
  onDelete?: (id: string) => void;
  onTabChange?: (tab: string) => void;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

const ENTRY_TYPE_ORDER: MemoryEntryType[] = ['fact', 'instruction', 'conversation', 'tool-result'];

const TYPE_LABELS: Record<MemoryEntryType, string> = {
  fact: 'Facts',
  instruction: 'Instructions',
  conversation: 'Conversation',
  'tool-result': 'Tool Results',
};

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '\u2026';
}

function groupBy(entries: MemoryEntry[]): Map<MemoryEntryType, MemoryEntry[]> {
  const map = new Map<MemoryEntryType, MemoryEntry[]>();
  for (const t of ENTRY_TYPE_ORDER) map.set(t, []);
  for (const entry of entries) {
    const list = map.get(entry.type);
    if (list) list.push(entry);
  }
  for (const [key, val] of map) {
    if (val.length === 0) map.delete(key);
  }
  return map;
}

/* ---------------------------------------------------------------------------
 * Widget
 * ------------------------------------------------------------------------- */

export function createMemoryInspector(props: MemoryInspectorProps): { view: StackLayout; dispose: () => void } {
  const {
    entries,
    totalTokens,
    maxTokens,
    activeTab = 'working',
    showContext = true,
    onDelete,
    onTabChange,
  } = props;

  let widgetState: MemoryInspectorState = 'viewing';
  let searchQuery = '';
  let selectedId: string | null = null;
  const disposers: (() => void)[] = [];

  function send(event: MemoryInspectorEvent) {
    widgetState = memoryInspectorReducer(widgetState, event);
    update();
  }

  const root = new StackLayout();
  root.className = 'memory-inspector';
  root.automationText = 'Memory inspector';

  // Tabs
  const tabBar = new FlexboxLayout();
  tabBar.className = 'memory-inspector-tabs';
  tabBar.flexDirection = 'row' as any;

  const TAB_VALUES = ['working', 'episodic', 'semantic', 'procedural'] as const;
  const TAB_LABELS: Record<string, string> = {
    working: 'Working', episodic: 'Episodic', semantic: 'Semantic', procedural: 'Procedural',
  };

  for (const tab of TAB_VALUES) {
    const tabBtn = new Button();
    tabBtn.className = tab === activeTab ? 'memory-inspector-tab-active' : 'memory-inspector-tab';
    tabBtn.text = TAB_LABELS[tab];
    const handler = () => {
      send({ type: 'SWITCH_TAB' });
      onTabChange?.(tab);
    };
    tabBtn.on('tap', handler);
    disposers.push(() => tabBtn.off('tap', handler));
    tabBar.addChild(tabBtn);
  }
  root.addChild(tabBar);

  // Search
  const searchField = new TextField();
  searchField.className = 'memory-inspector-search';
  searchField.hint = 'Search memories...';
  searchField.automationText = 'Search memories';
  const searchHandler = () => {
    searchQuery = searchField.text || '';
    if (searchQuery.trim()) {
      if (widgetState !== 'searching') send({ type: 'SEARCH' });
    } else {
      if (widgetState === 'searching') send({ type: 'CLEAR' });
    }
    rebuildEntries();
  };
  searchField.on('textChange', searchHandler);
  disposers.push(() => searchField.off('textChange', searchHandler));
  root.addChild(searchField);

  // Context bar
  if (showContext) {
    const contextBar = new StackLayout();
    contextBar.className = 'memory-inspector-context-bar';

    const tokenPercent = maxTokens > 0 ? Math.min((totalTokens / maxTokens) * 100, 100) : 0;

    const progressBar = new Progress();
    progressBar.className = 'memory-inspector-progress';
    progressBar.value = tokenPercent;
    progressBar.maxValue = 100;
    progressBar.automationText = `Context window: ${totalTokens.toLocaleString()} of ${maxTokens.toLocaleString()} tokens used`;
    contextBar.addChild(progressBar);

    const contextLabel = new Label();
    contextLabel.className = 'memory-inspector-context-label';
    contextLabel.text = `${totalTokens.toLocaleString()} / ${maxTokens.toLocaleString()} tokens`;
    contextBar.addChild(contextLabel);

    root.addChild(contextBar);
  }

  // Entry list
  const scrollView = new ScrollView();
  const entryContainer = new StackLayout();
  entryContainer.className = 'memory-inspector-entries';
  scrollView.content = entryContainer;
  root.addChild(scrollView);

  // Delete confirmation area
  const deleteConfirm = new StackLayout();
  deleteConfirm.className = 'memory-inspector-delete-confirm';
  deleteConfirm.visibility = 'collapse' as any;

  const deleteMsg = new Label();
  deleteMsg.text = 'Delete this memory entry?';
  deleteConfirm.addChild(deleteMsg);

  const confirmBtn = new Button();
  confirmBtn.text = 'Confirm';
  confirmBtn.automationText = 'Confirm delete';
  const confirmHandler = () => {
    if (selectedId) onDelete?.(selectedId);
    send({ type: 'CONFIRM' });
    selectedId = null;
    rebuildEntries();
  };
  confirmBtn.on('tap', confirmHandler);
  disposers.push(() => confirmBtn.off('tap', confirmHandler));
  deleteConfirm.addChild(confirmBtn);

  const cancelBtn = new Button();
  cancelBtn.text = 'Cancel';
  cancelBtn.automationText = 'Cancel delete';
  const cancelHandler = () => {
    send({ type: 'CANCEL' });
  };
  cancelBtn.on('tap', cancelHandler);
  disposers.push(() => cancelBtn.off('tap', cancelHandler));
  deleteConfirm.addChild(cancelBtn);

  root.addChild(deleteConfirm);

  function rebuildEntries() {
    entryContainer.removeChildren();
    const filtered = searchQuery.trim()
      ? entries.filter((e) =>
          e.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (e.source && e.source.toLowerCase().includes(searchQuery.toLowerCase())))
      : entries;

    const grouped = groupBy(filtered);

    for (const type of ENTRY_TYPE_ORDER) {
      const group = grouped.get(type);
      if (!group || group.length === 0) continue;

      const groupHeader = new Label();
      groupHeader.className = 'memory-inspector-group-header';
      groupHeader.text = `${TYPE_LABELS[type]} (${group.length})`;
      entryContainer.addChild(groupHeader);

      for (const entry of group) {
        const isSelected = selectedId === entry.id;

        const entryView = new StackLayout();
        entryView.className = isSelected ? 'memory-inspector-entry-selected' : 'memory-inspector-entry';
        entryView.automationText = `${entry.type}: ${truncate(entry.content, 60)}`;

        const typeLabel = new Label();
        typeLabel.className = 'memory-inspector-entry-type';
        typeLabel.text = entry.type;
        entryView.addChild(typeLabel);

        const contentLabel = new Label();
        contentLabel.className = 'memory-inspector-entry-content';
        contentLabel.text = isSelected ? entry.content : truncate(entry.content, 120);
        contentLabel.textWrap = true;
        entryView.addChild(contentLabel);

        if (entry.source) {
          const sourceLabel = new Label();
          sourceLabel.className = 'memory-inspector-entry-source';
          sourceLabel.text = entry.source;
          entryView.addChild(sourceLabel);
        }

        if (entry.timestamp) {
          const tsLabel = new Label();
          tsLabel.className = 'memory-inspector-entry-timestamp';
          tsLabel.text = entry.timestamp;
          entryView.addChild(tsLabel);
        }

        if (entry.relevance != null) {
          const relLabel = new Label();
          relLabel.className = 'memory-inspector-entry-relevance';
          relLabel.text = `${Math.round(entry.relevance * 100)}%`;
          entryView.addChild(relLabel);
        }

        if (isSelected && widgetState === 'entrySelected') {
          const deleteBtn = new Button();
          deleteBtn.className = 'memory-inspector-delete-btn';
          deleteBtn.text = 'Delete';
          deleteBtn.automationText = 'Delete memory entry';
          const delHandler = () => {
            send({ type: 'DELETE' });
          };
          deleteBtn.on('tap', delHandler);
          entryView.addChild(deleteBtn);
        }

        const tapHandler = () => {
          if (selectedId === entry.id) {
            selectedId = null;
            send({ type: 'DESELECT' });
          } else {
            selectedId = entry.id;
            send({ type: 'SELECT_ENTRY', id: entry.id });
          }
          rebuildEntries();
        };
        entryView.on('tap', tapHandler);

        entryContainer.addChild(entryView);
      }
    }

    if (filtered.length === 0) {
      const emptyLabel = new Label();
      emptyLabel.className = 'memory-inspector-empty';
      emptyLabel.text = searchQuery ? 'No matching entries found.' : 'No memory entries.';
      entryContainer.addChild(emptyLabel);
    }
  }

  rebuildEntries();

  function update() {
    deleteConfirm.visibility = (widgetState === 'deleting' ? 'visible' : 'collapse') as any;
  }

  return {
    view: root,
    dispose() {
      disposers.forEach((d) => d());
    },
  };
}

export default createMemoryInspector;
