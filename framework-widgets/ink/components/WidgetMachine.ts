// ============================================================
// Clef Surface Ink Widget — WidgetMachine
//
// Terminal-rendered headless component. Displays the state
// machine status as a status line and maps anatomy parts
// to terminal layout regions. Connects Clef Surface WidgetSpec to
// terminal rendering through the machine runner.
// ============================================================

import type {
  WidgetSpec,
  MachineState,
  ConnectedProps,
  AnatomyPart,
  Signal,
} from '../../shared/types.js';

import { createMachine, createSignal } from '../../shared/surface-bridge.js';
import type { TerminalNode } from './DesignTokenProvider.js';
import { hexToAnsiFg } from './DesignTokenProvider.js';

// --- ANSI Constants ---

const ANSI_RESET = '\x1b[0m';
const ANSI_BOLD = '\x1b[1m';
const ANSI_DIM = '\x1b[2m';
const ANSI_INVERSE = '\x1b[7m';
const ANSI_GREEN_FG = '\x1b[32m';
const ANSI_YELLOW_FG = '\x1b[33m';
const ANSI_RED_FG = '\x1b[31m';
const ANSI_CYAN_FG = '\x1b[36m';
const ANSI_MAGENTA_FG = '\x1b[35m';

// --- Border Characters ---

const BORDER = {
  topLeft: '\u250c', topRight: '\u2510',
  bottomLeft: '\u2514', bottomRight: '\u2518',
  horizontal: '\u2500', vertical: '\u2502',
  teeLeft: '\u251c', teeRight: '\u2524',
};

// --- State Icon Mapping ---

const STATE_ICONS: Record<string, string> = {
  idle: '\u25cb',       // ○
  active: '\u25cf',     // ●
  loading: '\u25d4',    // ◔
  disabled: '\u25cc',   // ◌
  error: '\u2716',      // ✖
  success: '\u2714',    // ✔
  focused: '\u25c9',    // ◉
  pressed: '\u25a3',    // ▣
  hover: '\u25ce',      // ◎
  open: '\u25bd',       // ▽
  closed: '\u25b7',     // ▷
  checked: '\u2611',    // ☑
  unchecked: '\u2610',  // ☐
};

function getStateIcon(stateName: string): string {
  return STATE_ICONS[stateName] || '\u25a1'; // □ fallback
}

function getStateColor(stateName: string): string {
  const colorMap: Record<string, string> = {
    idle: ANSI_DIM,
    active: ANSI_GREEN_FG,
    loading: ANSI_YELLOW_FG,
    disabled: ANSI_DIM,
    error: ANSI_RED_FG,
    success: ANSI_GREEN_FG,
    focused: ANSI_CYAN_FG,
    pressed: ANSI_MAGENTA_FG,
    hover: ANSI_CYAN_FG,
    open: ANSI_GREEN_FG,
    closed: ANSI_DIM,
    checked: ANSI_GREEN_FG,
    unchecked: ANSI_DIM,
  };
  return colorMap[stateName] || '';
}

// --- WidgetMachine Props ---

export interface WidgetMachineProps {
  /** Clef Surface widget specification. */
  spec: WidgetSpec;
  /** Initial context for the state machine. */
  initialContext?: Record<string, unknown>;
  /** Content renderers for each anatomy part. */
  partRenderers?: Record<string, (props: Record<string, unknown>) => TerminalNode | string>;
  /** Whether to show the status line. */
  showStatus?: boolean;
  /** Whether to show available transitions. */
  showTransitions?: boolean;
  /** Whether to show context values. */
  showContext?: boolean;
  /** Width in columns. */
  width?: number;
  /** Title override (defaults to spec.name). */
  title?: string;
  /** Accent color (hex). */
  accentColor?: string;
}

/**
 * Creates a static WidgetMachine terminal node.
 *
 * Renders the state machine status and anatomy parts
 * as a terminal layout. For full interactivity, use
 * WidgetMachineInteractive.
 */
export function createWidgetMachine(
  props: WidgetMachineProps,
  state?: MachineState,
  connectedProps?: ConnectedProps,
): TerminalNode {
  const {
    spec,
    initialContext,
    partRenderers = {},
    showStatus = true,
    showTransitions = false,
    showContext = false,
    width = 50,
    title,
    accentColor,
  } = props;

  const currentState = state || { current: spec.machineSpec.initial, context: initialContext || {} };
  const connected = connectedProps || {};
  const accentAnsi = accentColor ? hexToAnsiFg(accentColor) : ANSI_CYAN_FG;
  const innerWidth = width - 4;

  const children: (TerminalNode | string)[] = [];

  // Widget title bar
  const widgetTitle = title || spec.name;
  const stateIcon = getStateIcon(currentState.current);
  const stateColor = getStateColor(currentState.current);
  const titleLine = `${accentAnsi}${ANSI_BOLD}${widgetTitle}${ANSI_RESET} ${stateColor}${stateIcon} ${currentState.current}${ANSI_RESET}`;
  children.push({
    type: 'text',
    props: { role: 'widget-title' },
    children: [titleLine],
  });

  // Separator
  children.push({
    type: 'text',
    props: {},
    children: [`${ANSI_DIM}${BORDER.horizontal.repeat(innerWidth)}${ANSI_RESET}`],
  });

  // Status line
  if (showStatus) {
    const statusLine = buildStatusLine(spec, currentState, innerWidth);
    children.push({
      type: 'text',
      props: { role: 'status-line' },
      children: [statusLine],
    });
  }

  // Available transitions
  if (showTransitions) {
    const transitionNodes = buildTransitionList(spec, currentState);
    children.push(...transitionNodes);
  }

  // Context display
  if (showContext && Object.keys(currentState.context).length > 0) {
    children.push({
      type: 'text',
      props: { role: 'context-header' },
      children: [`${ANSI_DIM}Context:${ANSI_RESET}`],
    });
    for (const [key, value] of Object.entries(currentState.context)) {
      children.push({
        type: 'text',
        props: { role: 'context-entry', key },
        children: [`  ${ANSI_DIM}${key}: ${ANSI_RESET}${formatContextValue(value)}`],
      });
    }
  }

  // Anatomy parts
  if (spec.anatomy.parts.length > 0) {
    children.push({
      type: 'text',
      props: {},
      children: [`${ANSI_DIM}${BORDER.teeLeft}${BORDER.horizontal.repeat(innerWidth - 2)}${BORDER.teeRight}${ANSI_RESET}`],
    });

    for (const partName of spec.anatomy.parts) {
      const partProps = connected[partName] || {};
      const renderer = partRenderers[partName];

      if (renderer) {
        const partNode = renderer(partProps);
        children.push({
          type: 'box',
          props: {
            role: 'anatomy-part',
            partName,
            ...partProps,
          },
          children: [partNode],
        });
      } else {
        // Default rendering: show part name and props
        const propsStr = Object.entries(partProps)
          .filter(([k]) => !k.startsWith('data-'))
          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
          .join(' ');

        const dataState = partProps['data-state'] as string || '';
        const stateTag = dataState ? ` ${getStateColor(dataState)}[${dataState}]${ANSI_RESET}` : '';

        children.push({
          type: 'box',
          props: { role: 'anatomy-part', partName },
          children: [{
            type: 'text',
            props: {},
            children: [
              `  ${accentAnsi}\u25b8${ANSI_RESET} ${ANSI_BOLD}${partName}${ANSI_RESET}${stateTag}${propsStr ? ` ${ANSI_DIM}${propsStr}${ANSI_RESET}` : ''}`,
            ],
          }],
        });
      }
    }
  }

  // Slots
  if (spec.anatomy.slots && spec.anatomy.slots.length > 0) {
    children.push({
      type: 'text',
      props: { role: 'slots-header' },
      children: [`${ANSI_DIM}Slots: ${spec.anatomy.slots.join(', ')}${ANSI_RESET}`],
    });
  }

  return {
    type: 'box',
    props: {
      role: 'widget-machine',
      widgetName: spec.name,
      currentState: currentState.current,
      borderStyle: 'single',
      flexDirection: 'column',
      width,
      padding: 1,
    },
    children,
  };
}

// --- Helper Builders ---

function buildStatusLine(spec: WidgetSpec, state: MachineState, width: number): string {
  const allStates = Object.keys(spec.machineSpec.states);
  const parts: string[] = [];

  for (const s of allStates) {
    const isCurrent = s === state.current;
    if (isCurrent) {
      parts.push(`${getStateColor(s)}${ANSI_BOLD}[${s}]${ANSI_RESET}`);
    } else {
      parts.push(`${ANSI_DIM}${s}${ANSI_RESET}`);
    }
  }

  return parts.join(` ${ANSI_DIM}\u2192${ANSI_RESET} `);
}

function buildTransitionList(spec: WidgetSpec, state: MachineState): TerminalNode[] {
  const stateDef = spec.machineSpec.states[state.current];
  if (!stateDef?.on) return [];

  const nodes: TerminalNode[] = [];
  nodes.push({
    type: 'text',
    props: { role: 'transition-header' },
    children: [`${ANSI_DIM}Transitions:${ANSI_RESET}`],
  });

  for (const [event, target] of Object.entries(stateDef.on)) {
    const targetName = typeof target === 'string' ? target : target.target;
    const guard = typeof target === 'object' && target.guard ? ` ${ANSI_DIM}guard:${target.guard}${ANSI_RESET}` : '';
    nodes.push({
      type: 'text',
      props: { role: 'transition', event, target: targetName },
      children: [`  ${ANSI_YELLOW_FG}${event}${ANSI_RESET} \u2192 ${ANSI_CYAN_FG}${targetName}${ANSI_RESET}${guard}`],
    });
  }

  return nodes;
}

function formatContextValue(value: unknown): string {
  if (value === null || value === undefined) return `${ANSI_DIM}null${ANSI_RESET}`;
  if (typeof value === 'boolean') return value ? `${ANSI_GREEN_FG}true${ANSI_RESET}` : `${ANSI_RED_FG}false${ANSI_RESET}`;
  if (typeof value === 'number') return `${ANSI_CYAN_FG}${value}${ANSI_RESET}`;
  if (typeof value === 'string') return `${ANSI_YELLOW_FG}"${value}"${ANSI_RESET}`;
  return `${ANSI_DIM}${JSON.stringify(value)}${ANSI_RESET}`;
}

// --- Interactive WidgetMachine ---

export class WidgetMachineInteractive {
  private machine: ReturnType<typeof createMachine>;
  private spec: WidgetSpec;
  private props: WidgetMachineProps;
  private listeners: Set<(node: TerminalNode) => void> = new Set();
  private unsubscribe: (() => void) | null = null;
  private destroyed = false;

  constructor(props: WidgetMachineProps) {
    this.props = props;
    this.spec = props.spec;
    this.machine = createMachine(props.spec, props.initialContext);

    // Subscribe to machine state changes
    this.unsubscribe = this.machine.state.subscribe(() => {
      if (!this.destroyed) this.notify();
    });
  }

  /** Send an event to the state machine. */
  send(event: { type: string; [key: string]: unknown }): void {
    if (this.destroyed) return;
    this.machine.send(event);
  }

  /** Get the current machine state. */
  getState(): MachineState {
    return this.machine.state.get();
  }

  /** Get connected props for all anatomy parts. */
  getConnectedProps(): ConnectedProps {
    return this.machine.connect();
  }

  /** Get the state signal for reactive subscriptions. */
  getStateSignal(): Signal<MachineState> {
    return this.machine.state;
  }

  /** Handle keyboard input. Maps keys to machine events. */
  handleKey(key: string): boolean {
    if (this.destroyed) return false;

    const state = this.getState();
    const stateDef = this.spec.machineSpec.states[state.current];
    if (!stateDef?.on) return false;

    // Map common keys to event types
    const keyEventMap: Record<string, string> = {
      'return': 'SUBMIT',
      'enter': 'SUBMIT',
      'space': 'TOGGLE',
      'escape': 'CANCEL',
      'tab': 'FOCUS_NEXT',
      'up': 'PREV',
      'down': 'NEXT',
      'left': 'PREV',
      'right': 'NEXT',
    };

    const eventType = keyEventMap[key] || `KEY_${key.toUpperCase()}`;

    // Check if this event has a transition in current state
    if (stateDef.on[eventType]) {
      this.send({ type: eventType });
      return true;
    }

    return false;
  }

  /** Subscribe to re-renders. */
  onRender(listener: (node: TerminalNode) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  render(): TerminalNode {
    const state = this.getState();
    const connected = this.getConnectedProps();
    return createWidgetMachine(this.props, state, connected);
  }

  destroy(): void {
    this.destroyed = true;
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.machine.destroy();
    this.listeners.clear();
  }

  private notify(): void {
    const node = this.render();
    for (const listener of this.listeners) {
      listener(node);
    }
  }
}
