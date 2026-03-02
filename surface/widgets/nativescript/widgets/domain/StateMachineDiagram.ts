// ============================================================
// Clef Surface NativeScript Widget — StateMachineDiagram
//
// State machine visualization. Renders states as labelled
// boxes with transitions shown as arrows between them.
// Highlights the active state and supports state/transition
// selection.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  Button,
  ScrollView,
  Color,
  GestureTypes,
} from '@nativescript/core';

// --------------- Types ---------------

export interface StateDef {
  id: string;
  label: string;
  type?: 'initial' | 'normal' | 'final' | 'parallel' | 'history';
  color?: string;
}

export interface TransitionDef {
  from: string;
  to: string;
  event: string;
  guard?: string;
  action?: string;
}

export interface StateMachineDiagramProps {
  states?: StateDef[];
  transitions?: TransitionDef[];
  activeStateId?: string;
  selectedStateId?: string;
  selectedTransitionIndex?: number;
  machineName?: string;
  orientation?: 'horizontal' | 'vertical';
  showTransitionLabels?: boolean;
  accentColor?: string;
  onStateSelect?: (id: string) => void;
  onTransitionSelect?: (index: number) => void;
  onStateDoubleClick?: (id: string) => void;
}

// --------------- Helpers ---------------

const STATE_TYPE_ICONS: Record<string, string> = {
  initial: '\u25B6', normal: '\u25CB', final: '\u25C9',
  parallel: '\u2551', history: 'H',
};

const STATE_TYPE_SHAPES: Record<string, { borderRadius: number; borderWidth: number }> = {
  initial: { borderRadius: 20, borderWidth: 2 },
  normal: { borderRadius: 6, borderWidth: 1 },
  final: { borderRadius: 20, borderWidth: 3 },
  parallel: { borderRadius: 6, borderWidth: 2 },
  history: { borderRadius: 20, borderWidth: 1 },
};

// --------------- Component ---------------

export function createStateMachineDiagram(props: StateMachineDiagramProps = {}): StackLayout {
  const {
    states = [],
    transitions = [],
    activeStateId,
    selectedStateId,
    selectedTransitionIndex,
    machineName = 'State Machine',
    orientation = 'vertical',
    showTransitionLabels = true,
    accentColor = '#06b6d4',
    onStateSelect,
    onTransitionSelect,
    onStateDoubleClick,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-state-machine-diagram';
  container.padding = 8;

  // Header
  const header = new StackLayout();
  header.orientation = 'horizontal';
  header.marginBottom = 8;

  const titleLabel = new Label();
  titleLabel.text = `\u2699 ${machineName}`;
  titleLabel.fontWeight = 'bold';
  titleLabel.fontSize = 14;
  titleLabel.color = new Color(accentColor);
  titleLabel.marginRight = 8;
  header.addChild(titleLabel);

  const statsLabel = new Label();
  statsLabel.text = `${states.length} states, ${transitions.length} transitions`;
  statsLabel.fontSize = 11;
  statsLabel.opacity = 0.5;
  header.addChild(statsLabel);

  container.addChild(header);

  // Active state indicator
  if (activeStateId) {
    const activeState = states.find((s) => s.id === activeStateId);
    if (activeState) {
      const activeRow = new StackLayout();
      activeRow.orientation = 'horizontal';
      activeRow.marginBottom = 8;
      activeRow.padding = 6;
      activeRow.backgroundColor = new Color('#1a2a3a');
      activeRow.borderRadius = 4;

      const activeIcon = new Label();
      activeIcon.text = '\u25CF';
      activeIcon.color = new Color('#22c55e');
      activeIcon.marginRight = 4;
      activeRow.addChild(activeIcon);

      const activeLabel = new Label();
      activeLabel.text = `Active: ${activeState.label}`;
      activeLabel.fontWeight = 'bold';
      activeLabel.fontSize = 12;
      activeLabel.color = new Color('#22c55e');
      activeRow.addChild(activeLabel);

      container.addChild(activeRow);
    }
  }

  // Diagram area
  const scrollView = new ScrollView();
  const diagram = new StackLayout();
  diagram.padding = 4;
  diagram.backgroundColor = new Color('#0a0a1a');
  diagram.borderRadius = 6;
  diagram.borderWidth = 1;
  diagram.borderColor = new Color('#333333');

  // Build outgoing transition map
  const outgoing = new Map<string, TransitionDef[]>();
  transitions.forEach((t) => {
    if (!outgoing.has(t.from)) outgoing.set(t.from, []);
    outgoing.get(t.from)!.push(t);
  });

  // Render states
  states.forEach((state, stateIndex) => {
    const isActive = state.id === activeStateId;
    const isSelected = state.id === selectedStateId;
    const stateType = state.type || 'normal';
    const shape = STATE_TYPE_SHAPES[stateType] || STATE_TYPE_SHAPES.normal;

    const stateBox = new GridLayout();
    stateBox.columns = 'auto, *, auto';
    stateBox.padding = 8;
    stateBox.marginBottom = 2;
    stateBox.borderRadius = shape.borderRadius;
    stateBox.borderWidth = isSelected ? shape.borderWidth + 1 : shape.borderWidth;
    stateBox.borderColor = new Color(
      isActive ? '#22c55e' : isSelected ? accentColor : (state.color || '#555555')
    );
    stateBox.backgroundColor = new Color(
      isActive ? '#22c55e15' : isSelected ? '#1a2a3a' : '#111122'
    );

    // State type icon
    const typeIcon = new Label();
    typeIcon.text = STATE_TYPE_ICONS[stateType] || STATE_TYPE_ICONS.normal;
    typeIcon.fontSize = 12;
    typeIcon.color = new Color(isActive ? '#22c55e' : (state.color || '#888888'));
    typeIcon.marginRight = 8;
    typeIcon.verticalAlignment = 'middle';
    GridLayout.setColumn(typeIcon, 0);
    stateBox.addChild(typeIcon);

    // State label
    const stateLabel = new Label();
    stateLabel.text = state.label;
    stateLabel.fontSize = 13;
    stateLabel.fontWeight = isActive || isSelected ? 'bold' : 'normal';
    stateLabel.color = new Color(isActive ? '#22c55e' : '#e0e0e0');
    stateLabel.verticalAlignment = 'middle';
    GridLayout.setColumn(stateLabel, 1);
    stateBox.addChild(stateLabel);

    // Outgoing count
    const stateTransitions = outgoing.get(state.id) || [];
    if (stateTransitions.length > 0) {
      const outLabel = new Label();
      outLabel.text = `${stateTransitions.length}\u2192`;
      outLabel.fontSize = 10;
      outLabel.opacity = 0.4;
      outLabel.verticalAlignment = 'middle';
      GridLayout.setColumn(outLabel, 2);
      stateBox.addChild(outLabel);
    }

    stateBox.on(GestureTypes.tap as any, () => onStateSelect?.(state.id));
    stateBox.on(GestureTypes.doubleTap as any, () => onStateDoubleClick?.(state.id));

    diagram.addChild(stateBox);

    // Transitions from this state
    if (showTransitionLabels && stateTransitions.length > 0) {
      stateTransitions.forEach((trans, tIdx) => {
        const globalIdx = transitions.indexOf(trans);
        const isTransSelected = globalIdx === selectedTransitionIndex;

        const transRow = new StackLayout();
        transRow.orientation = 'horizontal';
        transRow.marginLeft = 24;
        transRow.marginBottom = 2;
        transRow.padding = 3;
        if (isTransSelected) {
          transRow.backgroundColor = new Color('#1a2a3a');
          transRow.borderRadius = 3;
        }

        const arrowLabel = new Label();
        arrowLabel.text = '\u2514\u2500\u2192 ';
        arrowLabel.fontSize = 10;
        arrowLabel.color = new Color('#555555');
        transRow.addChild(arrowLabel);

        const eventLabel = new Label();
        eventLabel.text = trans.event;
        eventLabel.fontSize = 11;
        eventLabel.fontWeight = 'bold';
        eventLabel.color = new Color(isTransSelected ? accentColor : '#eab308');
        transRow.addChild(eventLabel);

        const targetLabel = new Label();
        targetLabel.text = ` \u2192 ${trans.to}`;
        targetLabel.fontSize = 11;
        targetLabel.opacity = 0.7;
        transRow.addChild(targetLabel);

        if (trans.guard) {
          const guardLabel = new Label();
          guardLabel.text = ` [${trans.guard}]`;
          guardLabel.fontSize = 10;
          guardLabel.color = new Color('#8b5cf6');
          transRow.addChild(guardLabel);
        }

        if (trans.action) {
          const actionLabel = new Label();
          actionLabel.text = ` / ${trans.action}`;
          actionLabel.fontSize = 10;
          actionLabel.opacity = 0.4;
          transRow.addChild(actionLabel);
        }

        transRow.on(GestureTypes.tap as any, () => onTransitionSelect?.(globalIdx));
        diagram.addChild(transRow);
      });
    }
  });

  // Empty state
  if (states.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No states defined.';
    emptyLabel.opacity = 0.4;
    emptyLabel.horizontalAlignment = 'center';
    emptyLabel.marginTop = 20;
    diagram.addChild(emptyLabel);
  }

  scrollView.content = diagram;
  container.addChild(scrollView);

  return container;
}

export default createStateMachineDiagram;
