// ============================================================
// Clef Surface NativeScript Widget — StateMachineDiagram
//
// Visual state machine diagram with states and transitions.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';

export interface StateDef { id: string; name: string; initial?: boolean; final?: boolean; }
export interface TransitionDef { id: string; from: string; to: string; event: string; }

export interface StateMachineDiagramProps {
  states?: StateDef[];
  transitions?: TransitionDef[];
  currentStateId?: string;
  onStateClick?: (id: string) => void;
  onTransitionClick?: (id: string) => void;
}

export function createStateMachineDiagram(props: StateMachineDiagramProps): StackLayout {
  const { states = [], transitions = [], currentStateId, onStateClick, onTransitionClick } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-state-machine-diagram';
  container.accessibilityLabel = 'State machine diagram';

  for (const state of states) {
    const stateView = new StackLayout();
    stateView.orientation = 'horizontal';
    stateView.padding = '8';
    stateView.className = state.id === currentStateId ? 'clef-state-current' : 'clef-state';
    const indicator = new Label();
    indicator.text = state.initial ? '\u25B6' : state.final ? '\u25A0' : '\u25CB';
    indicator.marginRight = 8;
    stateView.addChild(indicator);
    const nameLabel = new Label();
    nameLabel.text = state.name;
    nameLabel.fontWeight = state.id === currentStateId ? 'bold' : 'normal';
    stateView.addChild(nameLabel);
    stateView.on('tap', () => onStateClick?.(state.id));
    container.addChild(stateView);
  }
  return container;
}

export default createStateMachineDiagram;
