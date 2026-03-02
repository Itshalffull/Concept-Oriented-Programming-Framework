// ============================================================
// Clef Surface NativeScript Widget — WidgetMachine
//
// State machine runner for NativeScript. Displays machine
// status, anatomy parts, transitions, and context. Maps
// gesture events to machine transitions.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  Button,
  Color,
  GestureTypes,
} from '@nativescript/core';

import type {
  WidgetSpec,
  MachineState,
  ConnectedProps,
} from '../../shared/types.js';
import { createMachine } from '../../shared/surface-bridge.js';

// --------------- State Visual Mapping ---------------

const STATE_ICONS: Record<string, string> = {
  idle: '\u25CB', active: '\u25CF', loading: '\u25D4', disabled: '\u25CC',
  error: '\u2716', success: '\u2714', focused: '\u25C9', pressed: '\u25A3',
  hover: '\u25CE', open: '\u25BD', closed: '\u25B7', checked: '\u2611', unchecked: '\u2610',
};

const STATE_COLORS: Record<string, string> = {
  idle: '#888888', active: '#22c55e', loading: '#eab308', disabled: '#888888',
  error: '#ef4444', success: '#22c55e', focused: '#06b6d4', pressed: '#a855f7',
  hover: '#06b6d4', open: '#22c55e', closed: '#888888', checked: '#22c55e', unchecked: '#888888',
};

// --------------- Props ---------------

export interface WidgetMachineProps {
  spec: WidgetSpec;
  initialContext?: Record<string, unknown>;
  showStatus?: boolean;
  showTransitions?: boolean;
  showContext?: boolean;
  width?: number;
  title?: string;
  accentColor?: string;
}

// --------------- Component ---------------

export function createWidgetMachine(props: WidgetMachineProps): StackLayout {
  const {
    spec,
    initialContext,
    showStatus = true,
    showTransitions = false,
    showContext = false,
    width,
    title,
    accentColor = '#06b6d4',
  } = props;

  const machine = createMachine(spec, initialContext);
  const container = new StackLayout();
  container.className = 'clef-widget-machine';
  container.padding = 8;
  container.borderWidth = 1;
  container.borderColor = new Color('#cccccc');
  if (width) container.width = width;

  // Title bar
  const titleBar = new StackLayout();
  titleBar.orientation = 'horizontal';
  const titleLabel = new Label();
  titleLabel.text = title || spec.name;
  titleLabel.fontWeight = 'bold';
  titleLabel.color = new Color(accentColor);
  titleBar.addChild(titleLabel);

  const stateLabel = new Label();
  const updateStateLabel = (state: MachineState) => {
    const icon = STATE_ICONS[state.current] || '\u25A1';
    stateLabel.text = ` ${icon} ${state.current}`;
    stateLabel.color = new Color(STATE_COLORS[state.current] || '#888888');
  };
  updateStateLabel(machine.state.get());
  titleBar.addChild(stateLabel);
  container.addChild(titleBar);

  // Status line
  if (showStatus) {
    const statusRow = new StackLayout();
    statusRow.orientation = 'horizontal';
    const states = Object.keys(spec.machineSpec.states);
    states.forEach((s, i) => {
      const sLabel = new Label();
      const isCurrent = s === machine.state.get().current;
      sLabel.text = isCurrent ? `[${s}]` : s;
      sLabel.fontWeight = isCurrent ? 'bold' : 'normal';
      sLabel.color = new Color(isCurrent ? (STATE_COLORS[s] || accentColor) : '#888888');
      statusRow.addChild(sLabel);
      if (i < states.length - 1) {
        const arrow = new Label();
        arrow.text = ' \u2192 ';
        arrow.opacity = 0.5;
        statusRow.addChild(arrow);
      }
    });
    container.addChild(statusRow);
  }

  // Transitions
  if (showTransitions) {
    const transContainer = new StackLayout();
    const transHeader = new Label();
    transHeader.text = 'Transitions:';
    transHeader.opacity = 0.5;
    transContainer.addChild(transHeader);

    const updateTransitions = (state: MachineState) => {
      // Clear previous transition labels (keep header)
      while (transContainer.getChildrenCount() > 1) {
        transContainer.removeChild(transContainer.getChildAt(transContainer.getChildrenCount() - 1));
      }
      const stateDef = spec.machineSpec.states[state.current];
      if (stateDef?.on) {
        Object.entries(stateDef.on).forEach(([event, target]) => {
          const targetName = typeof target === 'string' ? target : (target as any).target;
          const row = new Label();
          row.text = `  ${event} \u2192 ${targetName}`;
          transContainer.addChild(row);
        });
      }
    };
    updateTransitions(machine.state.get());
    container.addChild(transContainer);
  }

  // Context display
  if (showContext) {
    const ctxContainer = new StackLayout();
    const ctxHeader = new Label();
    ctxHeader.text = 'Context:';
    ctxHeader.opacity = 0.5;
    ctxContainer.addChild(ctxHeader);

    const updateContext = (state: MachineState) => {
      while (ctxContainer.getChildrenCount() > 1) {
        ctxContainer.removeChild(ctxContainer.getChildAt(ctxContainer.getChildrenCount() - 1));
      }
      Object.entries(state.context).forEach(([key, value]) => {
        const row = new Label();
        row.text = `  ${key}: ${JSON.stringify(value)}`;
        ctxContainer.addChild(row);
      });
    };
    updateContext(machine.state.get());
    container.addChild(ctxContainer);
  }

  // Anatomy parts
  if (spec.anatomy.parts.length > 0) {
    const partsContainer = new StackLayout();
    partsContainer.marginTop = 4;

    spec.anatomy.parts.forEach((partName) => {
      const partRow = new StackLayout();
      partRow.orientation = 'horizontal';
      const bullet = new Label();
      bullet.text = '\u25B8 ';
      bullet.color = new Color(accentColor);
      partRow.addChild(bullet);
      const partLabel = new Label();
      partLabel.text = partName;
      partLabel.fontWeight = 'bold';
      partRow.addChild(partLabel);
      partsContainer.addChild(partRow);
    });
    container.addChild(partsContainer);
  }

  // Subscribe to state changes
  machine.state.subscribe((state) => {
    updateStateLabel(state);
  });

  // Add tap gesture to send TOGGLE event
  container.on(GestureTypes.tap as any, () => {
    const currentState = machine.state.get().current;
    const stateDef = spec.machineSpec.states[currentState];
    if (stateDef?.on?.['TOGGLE']) {
      machine.send({ type: 'TOGGLE' });
    } else if (stateDef?.on?.['SUBMIT']) {
      machine.send({ type: 'SUBMIT' });
    }
  });

  return container;
}

export default createWidgetMachine;
