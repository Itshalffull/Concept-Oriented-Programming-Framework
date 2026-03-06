import { StackLayout, Label, FlexboxLayout, ActivityIndicator } from '@nativescript/core';

/* ---------------------------------------------------------------------------
 * ReasoningBlock state machine
 * States: collapsed (initial), expanded, streaming
 * ------------------------------------------------------------------------- */

export type ReasoningBlockState = 'collapsed' | 'expanded' | 'streaming';
export type ReasoningBlockEvent =
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'TOGGLE' }
  | { type: 'STREAM_START' }
  | { type: 'TOKEN' }
  | { type: 'STREAM_END' };

export function reasoningBlockReducer(state: ReasoningBlockState, event: ReasoningBlockEvent): ReasoningBlockState {
  switch (state) {
    case 'collapsed':
      if (event.type === 'EXPAND' || event.type === 'TOGGLE') return 'expanded';
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    case 'expanded':
      if (event.type === 'COLLAPSE' || event.type === 'TOGGLE') return 'collapsed';
      return state;
    case 'streaming':
      if (event.type === 'TOKEN') return 'streaming';
      if (event.type === 'STREAM_END') return 'collapsed';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface ReasoningBlockProps {
  content: string;
  collapsed: boolean;
  onToggle?: () => void;
  defaultExpanded?: boolean;
  showDuration?: boolean;
  streaming?: boolean;
  duration?: number;
}

/* ---------------------------------------------------------------------------
 * Widget
 * ------------------------------------------------------------------------- */

export function createReasoningBlock(props: ReasoningBlockProps): { view: StackLayout; dispose: () => void } {
  const {
    content,
    onToggle,
    defaultExpanded = false,
    showDuration = true,
    streaming = false,
    duration,
  } = props;

  const initialState: ReasoningBlockState = streaming
    ? 'streaming'
    : defaultExpanded
      ? 'expanded'
      : 'collapsed';

  let state: ReasoningBlockState = initialState;
  const disposers: (() => void)[] = [];

  function send(event: ReasoningBlockEvent) {
    state = reasoningBlockReducer(state, event);
    update();
  }

  const root = new StackLayout();
  root.className = 'reasoning-block';
  root.automationText = 'Model reasoning';

  // Header row
  const header = new FlexboxLayout();
  header.className = 'reasoning-block-header';
  header.flexDirection = 'row' as any;
  header.alignItems = 'center' as any;

  const headerIcon = new Label();
  headerIcon.className = 'reasoning-block-icon';
  headerIcon.text = '\uD83E\uDDE0';
  header.addChild(headerIcon);

  const headerText = new Label();
  headerText.className = 'reasoning-block-header-text';
  headerText.text = streaming ? 'Thinking...' : 'Reasoning';
  header.addChild(headerText);

  const durationLabel = new Label();
  durationLabel.className = 'reasoning-block-duration';
  durationLabel.visibility = 'collapse' as any;
  header.addChild(durationLabel);

  const streamingIndicator = new ActivityIndicator();
  streamingIndicator.className = 'reasoning-block-streaming';
  streamingIndicator.busy = true;
  streamingIndicator.width = 16;
  streamingIndicator.height = 16;
  streamingIndicator.visibility = (streaming ? 'visible' : 'collapse') as any;
  header.addChild(streamingIndicator);

  const headerTapHandler = () => {
    if (state === 'streaming') return;
    send({ type: 'TOGGLE' });
    onToggle?.();
  };
  header.on('tap', headerTapHandler);
  disposers.push(() => header.off('tap', headerTapHandler));

  root.addChild(header);

  // Body content
  const body = new StackLayout();
  body.className = 'reasoning-block-body';

  const contentLabel = new Label();
  contentLabel.className = 'reasoning-block-content';
  contentLabel.text = content;
  contentLabel.textWrap = true;
  body.addChild(contentLabel);

  root.addChild(body);

  function update() {
    const isBodyVisible = state === 'expanded' || state === 'streaming';
    body.visibility = (isBodyVisible ? 'visible' : 'collapse') as any;
    headerText.text = state === 'streaming' ? 'Thinking...' : 'Reasoning';
    streamingIndicator.visibility = (state === 'streaming' ? 'visible' : 'collapse') as any;
    streamingIndicator.busy = state === 'streaming';

    if (showDuration && state !== 'streaming' && duration != null) {
      durationLabel.text = `${duration}ms`;
      durationLabel.visibility = 'visible' as any;
    } else {
      durationLabel.visibility = 'collapse' as any;
    }
  }

  update();

  return {
    view: root,
    dispose() {
      disposers.forEach((d) => d());
    },
  };
}

export default createReasoningBlock;
