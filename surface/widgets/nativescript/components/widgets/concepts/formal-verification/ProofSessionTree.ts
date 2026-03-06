import {
  StackLayout,
  GridLayout,
  Label,
  Button,
  ScrollView,
  Color,
  View,
} from '@nativescript/core';

export type ProofSessionTreeState = 'idle' | 'selected' | 'ready' | 'fetching';
export type ProofSessionTreeEvent =
  | { type: 'SELECT' }
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'DESELECT' }
  | { type: 'LOAD_CHILDREN' }
  | { type: 'LOAD_COMPLETE' }
  | { type: 'LOAD_ERROR' };

export function proofSessionTreeReducer(state: ProofSessionTreeState, event: ProofSessionTreeEvent): ProofSessionTreeState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT') return 'selected';
      if (event.type === 'EXPAND') return 'idle';
      if (event.type === 'COLLAPSE') return 'idle';
      return state;
    case 'selected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT') return 'selected';
      return state;
    case 'ready':
      if (event.type === 'LOAD_CHILDREN') return 'fetching';
      return state;
    case 'fetching':
      if (event.type === 'LOAD_COMPLETE') return 'ready';
      if (event.type === 'LOAD_ERROR') return 'ready';
      return state;
    default:
      return state;
  }
}

export interface ProofGoal {
  id: string;
  label: string;
  status: 'open' | 'proved' | 'failed' | 'skipped';
  tactic?: string;
  children?: ProofGoal[];
  progress?: number;
}

export interface ProofSessionTreeProps {
  goals: ProofGoal[];
  selectedId?: string | undefined;
  expandedIds?: string[];
  onSelectGoal?: (id: string | undefined) => void;
}

const STATUS_ICONS: Record<string, string> = {
  proved: '\u2713',
  failed: '\u2717',
  open: '\u25CB',
  skipped: '\u2298',
};

const STATUS_LABELS: Record<string, string> = {
  proved: 'Proved',
  failed: 'Failed',
  open: 'Open',
  skipped: 'Skipped',
};

function countGoals(goals: ProofGoal[]): { total: number; proved: number } {
  let total = 0;
  let proved = 0;
  function walk(nodes: ProofGoal[]) {
    for (const goal of nodes) {
      total++;
      if (goal.status === 'proved') proved++;
      if (goal.children?.length) walk(goal.children);
    }
  }
  walk(goals);
  return { total, proved };
}

function findGoal(goals: ProofGoal[], id: string): ProofGoal | undefined {
  for (const goal of goals) {
    if (goal.id === id) return goal;
    if (goal.children?.length) {
      const found = findGoal(goal.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

export function createProofSessionTree(props: ProofSessionTreeProps): { view: View; dispose: () => void } {
  let state: ProofSessionTreeState = 'idle';
  let selectedId: string | undefined = props.selectedId;
  const expandedSet = new Set<string>(props.expandedIds ?? []);
  const disposers: (() => void)[] = [];

  function send(event: ProofSessionTreeEvent) {
    state = proofSessionTreeReducer(state, event);
  }

  const root = new StackLayout();
  root.className = 'clef-proof-session-tree';
  root.automationText = 'Proof session tree';

  function render() {
    root.removeChildren();
    const { total, proved } = countGoals(props.goals);

    // Summary
    const summaryLabel = new Label();
    summaryLabel.text = `${proved} of ${total} goals proved`;
    summaryLabel.fontWeight = 'bold';
    summaryLabel.fontSize = 14;
    summaryLabel.padding = '8 12';
    root.addChild(summaryLabel);

    // Tree
    const scroll = new ScrollView();
    const treeContainer = new StackLayout();

    function renderGoal(goal: ProofGoal, depth: number) {
      const row = new StackLayout();
      row.orientation = 'horizontal';
      row.padding = `4 4 4 ${depth * 20}`;
      row.className = selectedId === goal.id ? 'proof-goal selected' : 'proof-goal';
      if (selectedId === goal.id) {
        row.backgroundColor = new Color('#dbeafe');
      }

      const hasChildren = !!(goal.children?.length);
      const isExpanded = expandedSet.has(goal.id);

      // Expand/collapse trigger
      const expandLabel = new Label();
      expandLabel.text = hasChildren ? (isExpanded ? '\u25BC' : '\u25B6') : '  ';
      expandLabel.width = 20;
      expandLabel.fontSize = 12;
      if (hasChildren) {
        const expandHandler = () => {
          if (isExpanded) {
            expandedSet.delete(goal.id);
            send({ type: 'COLLAPSE' });
          } else {
            expandedSet.add(goal.id);
            send({ type: 'EXPAND' });
          }
          render();
        };
        expandLabel.on('tap', expandHandler);
        disposers.push(() => expandLabel.off('tap', expandHandler));
      }
      row.addChild(expandLabel);

      // Status icon
      const statusLabel = new Label();
      statusLabel.text = STATUS_ICONS[goal.status] ?? '\u25CB';
      statusLabel.width = 20;
      statusLabel.fontSize = 14;
      row.addChild(statusLabel);

      // Goal label
      const goalLabel = new Label();
      goalLabel.text = goal.label;
      goalLabel.fontSize = 13;
      row.addChild(goalLabel);

      // Progress
      if (goal.progress != null) {
        const progressLabel = new Label();
        progressLabel.text = ` ${Math.round(goal.progress * 100)}%`;
        progressLabel.fontSize = 11;
        progressLabel.color = new Color('#6b7280');
        progressLabel.marginLeft = 8;
        row.addChild(progressLabel);
      }

      // Tap to select
      const rowHandler = () => {
        const nextId = selectedId === goal.id ? undefined : goal.id;
        selectedId = nextId;
        send({ type: nextId ? 'SELECT' : 'DESELECT' });
        props.onSelectGoal?.(nextId);
        render();
      };
      row.on('tap', rowHandler);
      disposers.push(() => row.off('tap', rowHandler));

      row.automationText = `${goal.label} - ${STATUS_LABELS[goal.status]}`;
      treeContainer.addChild(row);

      // Render children if expanded
      if (hasChildren && isExpanded) {
        for (const child of goal.children!) {
          renderGoal(child, depth + 1);
        }
      }
    }

    for (const goal of props.goals) {
      renderGoal(goal, 0);
    }

    scroll.content = treeContainer;
    root.addChild(scroll);

    // Detail panel
    if (selectedId) {
      const selectedGoal = findGoal(props.goals, selectedId);
      if (selectedGoal) {
        const detail = new StackLayout();
        detail.padding = '8 12';
        detail.borderTopWidth = 1;
        detail.borderTopColor = new Color('#e5e7eb');

        const detailHeader = new StackLayout();
        detailHeader.orientation = 'horizontal';
        const statusText = new Label();
        statusText.text = `${STATUS_ICONS[selectedGoal.status]} ${STATUS_LABELS[selectedGoal.status]}`;
        statusText.fontWeight = 'bold';
        statusText.fontSize = 14;
        detailHeader.addChild(statusText);

        const closeBtn = new Button();
        closeBtn.text = '\u2715';
        closeBtn.fontSize = 12;
        closeBtn.marginLeft = 12;
        const closeHandler = () => {
          selectedId = undefined;
          send({ type: 'DESELECT' });
          props.onSelectGoal?.(undefined);
          render();
        };
        closeBtn.on('tap', closeHandler);
        disposers.push(() => closeBtn.off('tap', closeHandler));
        detailHeader.addChild(closeBtn);
        detail.addChild(detailHeader);

        const goalField = new Label();
        goalField.text = `Goal: ${selectedGoal.label}`;
        goalField.fontSize = 13;
        goalField.padding = '4 0';
        detail.addChild(goalField);

        if (selectedGoal.tactic) {
          const tacticField = new Label();
          tacticField.text = `Tactic: ${selectedGoal.tactic}`;
          tacticField.fontSize = 13;
          detail.addChild(tacticField);
        }

        if (selectedGoal.progress != null) {
          const progressField = new Label();
          progressField.text = `Progress: ${Math.round(selectedGoal.progress * 100)}%`;
          progressField.fontSize = 13;
          detail.addChild(progressField);
        }

        if (selectedGoal.children && selectedGoal.children.length > 0) {
          const subField = new Label();
          subField.text = `Sub-goals: ${selectedGoal.children.length}`;
          subField.fontSize = 13;
          detail.addChild(subField);
        }

        root.addChild(detail);
      }
    }
  }

  render();

  return {
    view: root,
    dispose() { disposers.forEach((d) => d()); },
  };
}

export default createProofSessionTree;
