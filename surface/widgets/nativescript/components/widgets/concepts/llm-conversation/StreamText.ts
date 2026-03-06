import { StackLayout, Label, Button, ScrollView, ActivityIndicator } from '@nativescript/core';

/* ---------------------------------------------------------------------------
 * StreamText state machine
 * States: idle, streaming, complete, stopped
 * ------------------------------------------------------------------------- */

export type StreamTextState = 'idle' | 'streaming' | 'complete' | 'stopped';
export type StreamTextEvent =
  | { type: 'STREAM_START' }
  | { type: 'TOKEN' }
  | { type: 'STREAM_END' }
  | { type: 'STOP' };

export function streamTextReducer(state: StreamTextState, event: StreamTextEvent): StreamTextState {
  switch (state) {
    case 'idle':
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    case 'streaming':
      if (event.type === 'TOKEN') return 'streaming';
      if (event.type === 'STREAM_END') return 'complete';
      if (event.type === 'STOP') return 'stopped';
      return state;
    case 'complete':
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    case 'stopped':
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface StreamTextProps {
  content: string;
  streaming: boolean;
  onStop?: () => void;
  renderMarkdown?: boolean;
  cursorStyle?: 'bar' | 'block' | 'underline';
  smoothScroll?: boolean;
}

/* ---------------------------------------------------------------------------
 * Widget
 * ------------------------------------------------------------------------- */

export function createStreamText(props: StreamTextProps): { view: StackLayout; dispose: () => void } {
  const {
    content,
    streaming,
    onStop,
  } = props;

  let state: StreamTextState = streaming ? 'streaming' : 'idle';
  const disposers: (() => void)[] = [];

  function send(event: StreamTextEvent) {
    state = streamTextReducer(state, event);
    update();
  }

  const root = new StackLayout();
  root.className = 'stream-text';
  root.automationText = 'Streaming response';

  // Text content area
  const scrollView = new ScrollView();
  scrollView.className = 'stream-text-scroll';

  const textBlock = new Label();
  textBlock.className = 'stream-text-content';
  textBlock.text = content;
  textBlock.textWrap = true;
  scrollView.content = textBlock;
  root.addChild(scrollView);

  // Streaming indicator
  const streamingRow = new StackLayout();
  streamingRow.className = 'stream-text-streaming-row';

  const cursorIndicator = new ActivityIndicator();
  cursorIndicator.className = 'stream-text-cursor';
  cursorIndicator.busy = true;
  cursorIndicator.width = 16;
  cursorIndicator.height = 16;
  cursorIndicator.visibility = (streaming ? 'visible' : 'collapse') as any;
  streamingRow.addChild(cursorIndicator);

  // Stop button
  const stopBtn = new Button();
  stopBtn.className = 'stream-text-stop';
  stopBtn.text = 'Stop';
  stopBtn.automationText = 'Stop generation';
  stopBtn.visibility = (streaming ? 'visible' : 'collapse') as any;
  const stopHandler = () => {
    if (state !== 'streaming') return;
    send({ type: 'STOP' });
    onStop?.();
  };
  stopBtn.on('tap', stopHandler);
  disposers.push(() => stopBtn.off('tap', stopHandler));
  streamingRow.addChild(stopBtn);

  root.addChild(streamingRow);

  // Sync streaming prop
  if (streaming) {
    send({ type: 'STREAM_START' });
  }

  function update() {
    const isStreaming = state === 'streaming';
    cursorIndicator.visibility = (isStreaming ? 'visible' : 'collapse') as any;
    cursorIndicator.busy = isStreaming;
    stopBtn.visibility = (isStreaming ? 'visible' : 'collapse') as any;
  }

  return {
    view: root,
    dispose() {
      disposers.forEach((d) => d());
    },
  };
}

export default createStreamText;
