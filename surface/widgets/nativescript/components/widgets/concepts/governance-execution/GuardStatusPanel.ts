import {
  StackLayout,
  GridLayout,
  Label,
  Button,
  TextField,
  TextView,
  ScrollView,
  Progress,
  ActivityIndicator,
  Switch,
  WrapLayout,
  Color,
  View,
} from '@nativescript/core';

export type GuardStatusPanelState = 'idle' | 'guardSelected';
export type GuardStatusPanelEvent =
  | { type: 'SELECT_GUARD' }
  | { type: 'GUARD_TRIP' }
  | { type: 'DESELECT' };

export function guardStatusPanelReducer(state: GuardStatusPanelState, event: GuardStatusPanelEvent): GuardStatusPanelState {
  switch (state) {
    case 'idle': if (event.type === 'SELECT_GUARD') return 'guardSelected'; if (event.type === 'GUARD_TRIP') return 'idle'; return state;
    case 'guardSelected': if (event.type === 'DESELECT') return 'idle'; return state;
    default:
      return state;
  }
}

export type GuardStatus = 'passing' | 'failing' | 'pending' | 'bypassed';
export interface Guard { id?: string; name: string; description: string; status: GuardStatus; lastChecked?: string; }
const STATUS_ICONS: Record<GuardStatus, string> = { passing: '\u2713', failing: '\u2717', pending: '\u23F3', bypassed: '\u2298' };
const STATUS_COLORS: Record<GuardStatus, string> = { passing: '#22c55e', failing: '#ef4444', pending: '#9ca3af', bypassed: '#6b7280' };

export interface GuardStatusPanelProps {
  guards: Guard[];
  executionStatus: string;
  showConditions?: boolean;
  onGuardSelect?: (guard: Guard) => void;
}

export function createGuardStatusPanel(props: GuardStatusPanelProps): { view: View; dispose: () => void } {
  let state: GuardStatusPanelState = 'idle';
  const disposers: (() => void)[] = [];

  function send(event: GuardStatusPanelEvent) {
    state = guardStatusPanelReducer(state, event);
    update();
  }

  
  let selectedGuard: Guard | null = null;
  const root = new StackLayout();
  root.className = 'clef-guard-status-panel';
  root.automationText = 'Guard status panel';
  root.padding = '8';

  function render() {
    root.removeChildren();
    const header = new Label();
    header.text = 'Guard Status - ' + props.executionStatus;
    header.fontWeight = 'bold';
    header.fontSize = 14;
    header.padding = '4 12';
    root.addChild(header);

    const hasFailing = props.guards.some(g => g.status === 'failing');
    const overallLabel = new Label();
    overallLabel.text = hasFailing ? '\u26A0 Some guards failing' : '\u2713 All guards passing';
    overallLabel.fontSize = 12;
    overallLabel.padding = '4 12';
    overallLabel.color = new Color(hasFailing ? '#ef4444' : '#22c55e');
    root.addChild(overallLabel);

    const scroll = new ScrollView();
    const list = new StackLayout();
    for (const guard of props.guards) {
      const row = new StackLayout();
      row.padding = '8 12';
      if (selectedGuard?.name === guard.name) row.backgroundColor = new Color('#dbeafe');
      row.borderBottomWidth = 1;
      row.borderBottomColor = new Color('#f3f4f6');

      const nameRow = new StackLayout();
      nameRow.orientation = 'horizontal';
      const icon = new Label();
      icon.text = STATUS_ICONS[guard.status];
      icon.color = new Color(STATUS_COLORS[guard.status]);
      icon.fontSize = 14;
      icon.width = 24;
      nameRow.addChild(icon);
      const nameLabel = new Label();
      nameLabel.text = guard.name;
      nameLabel.fontSize = 13;
      nameLabel.fontWeight = 'bold';
      nameRow.addChild(nameLabel);
      row.addChild(nameRow);

      if (props.showConditions !== false) {
        const descLabel = new Label();
        descLabel.text = guard.description;
        descLabel.fontSize = 12;
        descLabel.color = new Color('#6b7280');
        descLabel.textWrap = true;
        row.addChild(descLabel);
      }

      if (guard.lastChecked) {
        const checkedLabel = new Label();
        checkedLabel.text = 'Last checked: ' + guard.lastChecked;
        checkedLabel.fontSize = 11;
        checkedLabel.color = new Color('#9ca3af');
        row.addChild(checkedLabel);
      }

      const handler = () => { selectedGuard = guard; send({ type: 'SELECT_GUARD' }); props.onGuardSelect?.(guard); render(); };
      row.on('tap', handler);
      disposers.push(() => row.off('tap', handler));
      row.automationText = guard.name + ' - ' + guard.status;
      list.addChild(row);
    }
    scroll.content = list;
    root.addChild(scroll);
  }
  render();

  function update() {
    // State-dependent UI updates handled inline
  }

  update();

  return {
    view: root,
    dispose() { disposers.forEach(d => d()); },
  };
}

export default createGuardStatusPanel;
