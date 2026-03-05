import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

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

export interface StreamTextProps { [key: string]: unknown; class?: string; }
export interface StreamTextResult { element: HTMLElement; dispose: () => void; }

export function StreamText(props: StreamTextProps): StreamTextResult {
  const sig = surfaceCreateSignal<StreamTextState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(streamTextReducer(sig.get(), { type } as any));

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'stream-text');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Streaming response');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (sig.get() === 'streaming') {
        send('STOP');
      }
    }
  });

  const textBlockEl = document.createElement('div');
  textBlockEl.setAttribute('data-part', 'text-block');
  textBlockEl.style.overflow = 'auto';
  root.appendChild(textBlockEl);

  const cursorEl = document.createElement('span');
  cursorEl.setAttribute('data-part', 'cursor');
  cursorEl.setAttribute('aria-hidden', 'true');
  cursorEl.style.display = 'none';
  root.appendChild(cursorEl);

  const stopButtonEl = document.createElement('button');
  stopButtonEl.setAttribute('type', 'button');
  stopButtonEl.setAttribute('data-part', 'stop-button');
  stopButtonEl.setAttribute('aria-label', 'Stop generation');
  stopButtonEl.setAttribute('tabindex', '0');
  stopButtonEl.textContent = 'Stop';
  stopButtonEl.style.display = 'none';
  stopButtonEl.addEventListener('click', () => {
    if (sig.get() === 'streaming') {
      send('STOP');
    }
  });
  root.appendChild(stopButtonEl);

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    root.setAttribute('aria-busy', s === 'streaming' ? 'true' : 'false');
    textBlockEl.setAttribute('data-state', s);
    cursorEl.setAttribute('data-state', s);
    cursorEl.setAttribute('data-visible', s === 'streaming' ? 'true' : 'false');
    cursorEl.style.display = s === 'streaming' ? 'inline-block' : 'none';
    stopButtonEl.setAttribute('data-state', s);
    stopButtonEl.setAttribute('data-visible', s === 'streaming' ? 'true' : 'false');
    stopButtonEl.style.display = s === 'streaming' ? '' : 'none';
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default StreamText;
