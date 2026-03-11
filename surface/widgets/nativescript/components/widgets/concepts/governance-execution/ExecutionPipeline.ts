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

export type ExecutionPipelineState = 'idle' | 'stageSelected' | 'failed';
export type ExecutionPipelineEvent =
  | { type: 'ADVANCE' }
  | { type: 'SELECT_STAGE' }
  | { type: 'FAIL' }
  | { type: 'DESELECT' }
  | { type: 'RETRY' }
  | { type: 'RESET' };

export function executionPipelineReducer(state: ExecutionPipelineState, event: ExecutionPipelineEvent): ExecutionPipelineState {
  switch (state) {
    case 'idle': if (event.type === 'ADVANCE') return 'idle'; if (event.type === 'SELECT_STAGE') return 'stageSelected'; if (event.type === 'FAIL') return 'failed'; return state;
    case 'stageSelected': if (event.type === 'DESELECT') return 'idle'; return state;
    case 'failed': if (event.type === 'RETRY') return 'idle'; if (event.type === 'RESET') return 'idle'; return state;
    default:
      return state;
  }
}

export type PipelineStageStatus = 'pending' | 'active' | 'complete' | 'failed' | 'skipped';
export interface PipelineStage { id: string; name: string; status: PipelineStageStatus; description?: string; isTimelock?: boolean; }
const STATUS_ICONS: Record<PipelineStageStatus, string> = { pending: '\u25CB', active: '\u25B6', complete: '\u2713', failed: '\u2717', skipped: '\u2298' };

export interface ExecutionPipelineProps {
  stages: PipelineStage[];
  currentStage: string;
  status: string;
  showTimer?: boolean;
  showActions?: boolean;
  compact?: boolean;
  onStageSelect?: (stageId: string) => void;
  onRetry?: () => void;
}

export function createExecutionPipeline(props: ExecutionPipelineProps): { view: View; dispose: () => void } {
  let state: ExecutionPipelineState = 'idle';
  const disposers: (() => void)[] = [];

  function send(event: ExecutionPipelineEvent) {
    state = executionPipelineReducer(state, event);
    update();
  }

  
  let selectedStageId: string | null = null;
  const root = new StackLayout();
  root.className = 'clef-execution-pipeline';
  root.automationText = 'Execution pipeline';
  root.padding = '8';

  function render() {
    root.removeChildren();
    const statusBar = new Label();
    statusBar.text = 'Pipeline: ' + props.status;
    statusBar.fontWeight = 'bold';
    statusBar.fontSize = 14;
    statusBar.padding = '4 12';
    root.addChild(statusBar);

    const scroll = new ScrollView();
    const list = new StackLayout();
    props.stages.forEach((stage, i) => {
      const row = new StackLayout();
      row.orientation = 'horizontal';
      row.padding = '6 12';
      if (stage.id === props.currentStage) row.backgroundColor = new Color('#dbeafe');
      if (selectedStageId === stage.id) row.borderWidth = 2; row.borderColor = new Color(selectedStageId === stage.id ? '#6366f1' : 'transparent');

      const icon = new Label();
      icon.text = STATUS_ICONS[stage.status];
      icon.width = 24;
      icon.fontSize = 14;
      row.addChild(icon);

      const nameLabel = new Label();
      nameLabel.text = stage.name;
      nameLabel.fontSize = 13;
      nameLabel.fontWeight = stage.id === props.currentStage ? 'bold' : 'normal';
      row.addChild(nameLabel);

      if (stage.description) {
        const desc = new Label();
        desc.text = ' - ' + stage.description;
        desc.fontSize = 11;
        desc.color = new Color('#6b7280');
        row.addChild(desc);
      }

      const handler = () => { selectedStageId = stage.id; send({ type: 'SELECT_STAGE' }); props.onStageSelect?.(stage.id); render(); };
      row.on('tap', handler);
      disposers.push(() => row.off('tap', handler));
      row.automationText = stage.name + ' - ' + stage.status;
      list.addChild(row);

      if (i < props.stages.length - 1) {
        const connector = new Label();
        connector.text = '  |';
        connector.fontSize = 10;
        connector.color = new Color('#d1d5db');
        connector.padding = '0 0 0 18';
        list.addChild(connector);
      }
    });
    scroll.content = list;
    root.addChild(scroll);

    if (props.showActions && props.status === 'failed') {
      const retryBtn = new Button();
      retryBtn.text = 'Retry';
      retryBtn.fontSize = 13;
      retryBtn.margin = '8 12';
      const rh = () => { send({ type: 'RETRY' }); props.onRetry?.(); };
      retryBtn.on('tap', rh);
      disposers.push(() => retryBtn.off('tap', rh));
      root.addChild(retryBtn);
    }
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

export default createExecutionPipeline;
