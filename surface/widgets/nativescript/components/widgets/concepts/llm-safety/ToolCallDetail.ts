import {
  StackLayout,
  Label,
  Button,
} from '@nativescript/core';

export type ToolCallDetailState = 'idle' | 'retrying';
export type ToolCallDetailEvent =
  | { type: 'EXPAND_ARGS' }
  | { type: 'EXPAND_RESULT' }
  | { type: 'RETRY' }
  | { type: 'RETRY_COMPLETE' }
  | { type: 'RETRY_ERROR' };

export function toolCallDetailReducer(state: ToolCallDetailState, event: ToolCallDetailEvent): ToolCallDetailState {
  switch (state) {
    case 'idle':
      if (event.type === 'EXPAND_ARGS') return 'idle';
      if (event.type === 'EXPAND_RESULT') return 'idle';
      if (event.type === 'RETRY') return 'retrying';
      return state;
    case 'retrying':
      if (event.type === 'RETRY_COMPLETE') return 'idle';
      if (event.type === 'RETRY_ERROR') return 'idle';
      return state;
    default:
      return state;
  }
}

export type ToolCallStatus = 'pending' | 'success' | 'error';

export interface ToolCallDetailProps {
  toolName: string;
  input: string | Record<string, unknown>;
  output?: string | Record<string, unknown>;
  status?: ToolCallStatus;
  duration?: number;
  timestamp?: string;
  arguments?: string;
  result?: string;
  timing?: number;
  tokenUsage?: number;
  error?: string;
  showTiming?: boolean;
  showTokens?: boolean;
  onRetry?: () => void;
  onRetryComplete?: () => void;
  onRetryError?: (error: string) => void;
}

function formatJson(value: string | Record<string, unknown> | undefined | null): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
}

const STATUS_LABELS: Record<ToolCallStatus, string> = {
  pending: 'Pending',
  success: 'Success',
  error: 'Error',
};

export function createToolCallDetail(props: ToolCallDetailProps): {
  view: StackLayout;
  dispose: () => void;
} {
  let state: ToolCallDetailState = 'idle';
  let argsExpanded = true;
  let resultExpanded = true;
  const disposers: (() => void)[] = [];

  const resolvedInput = props.input ?? props.arguments ?? '';
  const resolvedOutput = props.output ?? props.result;
  const resolvedDuration = props.duration ?? props.timing;
  const resolvedStatus: ToolCallStatus = props.error ? 'error' : (props.status ?? 'pending');
  const errorMessage = props.error ?? (resolvedStatus === 'error' && typeof resolvedOutput === 'string' ? resolvedOutput : undefined);
  const formattedInput = formatJson(resolvedInput);
  const formattedOutput = formatJson(resolvedOutput);

  function send(event: ToolCallDetailEvent) {
    state = toolCallDetailReducer(state, event);
    update();
  }

  const root = new StackLayout();
  root.className = 'tool-call-detail';
  root.automationText = `Tool call: ${props.toolName}`;

  const header = new StackLayout();
  header.orientation = 'horizontal';
  header.padding = '10 12';

  const toolNameLbl = new Label();
  toolNameLbl.text = props.toolName;
  toolNameLbl.fontWeight = 'bold';
  toolNameLbl.fontFamily = 'monospace';
  header.addChild(toolNameLbl);

  const statusBadge = new Label();
  statusBadge.text = STATUS_LABELS[resolvedStatus];
  statusBadge.marginLeft = 8;
  statusBadge.className = `status-${resolvedStatus}`;
  header.addChild(statusBadge);

  if (resolvedDuration !== undefined && props.showTiming !== false) {
    const timingLbl = new Label();
    timingLbl.text = `${resolvedDuration}ms`;
    timingLbl.marginLeft = 8;
    timingLbl.fontSize = 12;
    header.addChild(timingLbl);
  }
  root.addChild(header);

  const argsSection = new StackLayout();
  const argsToggle = new Button();
  argsToggle.text = 'Input';
  const argsToggleCb = () => {
    argsExpanded = !argsExpanded;
    send({ type: 'EXPAND_ARGS' });
  };
  argsToggle.on('tap', argsToggleCb);
  disposers.push(() => argsToggle.off('tap', argsToggleCb));
  argsSection.addChild(argsToggle);

  const argsContent = new Label();
  argsContent.text = formattedInput;
  argsContent.textWrap = true;
  argsContent.fontFamily = 'monospace';
  argsContent.fontSize = 12;
  argsSection.addChild(argsContent);
  root.addChild(argsSection);

  const resultSection = new StackLayout();
  if (resolvedOutput !== undefined || errorMessage) {
    const resultToggle = new Button();
    resultToggle.text = 'Output';
    const resultToggleCb = () => {
      resultExpanded = !resultExpanded;
      send({ type: 'EXPAND_RESULT' });
    };
    resultToggle.on('tap', resultToggleCb);
    disposers.push(() => resultToggle.off('tap', resultToggleCb));
    resultSection.addChild(resultToggle);

    const resultContent = new Label();
    if (resolvedStatus === 'error' && errorMessage) {
      resultContent.text = errorMessage;
      resultContent.color = '#991b1b' as any;
    } else {
      resultContent.text = formattedOutput;
    }
    resultContent.textWrap = true;
    resultContent.fontFamily = 'monospace';
    resultContent.fontSize = 12;
    resultSection.addChild(resultContent);
    root.addChild(resultSection);
  }

  if (props.showTokens !== false && props.tokenUsage !== undefined) {
    const tokenBadge = new Label();
    tokenBadge.text = `${props.tokenUsage} tokens`;
    tokenBadge.fontSize = 12;
    tokenBadge.margin = '8 12';
    root.addChild(tokenBadge);
  }

  if (props.timestamp) {
    const tsLbl = new Label();
    tsLbl.text = props.timestamp;
    tsLbl.fontSize = 12;
    tsLbl.padding = '4 12 8 12';
    root.addChild(tsLbl);
  }

  const retryBtn = new Button();
  retryBtn.text = 'Retry';
  const retryCb = () => {
    if (state === 'retrying') return;
    send({ type: 'RETRY' });
    props.onRetry?.();
  };
  retryBtn.on('tap', retryCb);
  disposers.push(() => retryBtn.off('tap', retryCb));
  root.addChild(retryBtn);

  function update() {
    argsContent.visibility = argsExpanded ? 'visible' : 'collapsed';
    if (resultSection.getChildrenCount() > 1) {
      (resultSection.getChildAt(1) as Label).visibility = resultExpanded ? 'visible' : 'collapsed';
    }
    retryBtn.visibility = errorMessage ? 'visible' : 'collapsed';
    retryBtn.isEnabled = state !== 'retrying';
    retryBtn.text = state === 'retrying' ? 'Retrying...' : 'Retry';
  }

  update();

  return {
    view: root,
    dispose() {
      disposers.forEach((d) => d());
    },
  };
}

export default createToolCallDetail;
