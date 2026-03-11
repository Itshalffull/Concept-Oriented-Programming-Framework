import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type MessageActionsState = 'hidden' | 'visible' | 'copied';
export type MessageActionsEvent =
  | { type: 'SHOW' }
  | { type: 'HIDE' }
  | { type: 'COPY' }
  | { type: 'COPY_TIMEOUT' };

export function messageActionsReducer(state: MessageActionsState, event: MessageActionsEvent): MessageActionsState {
  switch (state) {
    case 'hidden':
      if (event.type === 'SHOW') return 'visible';
      return state;
    case 'visible':
      if (event.type === 'HIDE') return 'hidden';
      if (event.type === 'COPY') return 'copied';
      return state;
    case 'copied':
      if (event.type === 'COPY_TIMEOUT') return 'visible';
      return state;
    default:
      return state;
  }
}

export interface MessageActionsProps { [key: string]: unknown; class?: string; }
export interface MessageActionsResult { element: HTMLElement; dispose: () => void; }

export function MessageActions(props: MessageActionsProps): MessageActionsResult {
  const sig = surfaceCreateSignal<MessageActionsState>('hidden');
  const state = () => sig.get();
  const send = (type: string) => sig.set(messageActionsReducer(sig.get(), { type } as any));

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'message-actions');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'toolbar');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  const thumbsUpEl = document.createElement('button');
  thumbsUpEl.setAttribute('data-part', 'thumbs-up');
  root.appendChild(thumbsUpEl);
  const thumbsDownEl = document.createElement('button');
  thumbsDownEl.setAttribute('data-part', 'thumbs-down');
  root.appendChild(thumbsDownEl);
  const copyButtonEl = document.createElement('button');
  copyButtonEl.setAttribute('data-part', 'copy-button');
  root.appendChild(copyButtonEl);
  const regenerateEl = document.createElement('button');
  regenerateEl.setAttribute('data-part', 'regenerate');
  root.appendChild(regenerateEl);
  const editButtonEl = document.createElement('button');
  editButtonEl.setAttribute('data-part', 'edit-button');
  root.appendChild(editButtonEl);
  const shareButtonEl = document.createElement('button');
  shareButtonEl.setAttribute('data-part', 'share-button');
  root.appendChild(shareButtonEl);
  const moreButtonEl = document.createElement('button');
  moreButtonEl.setAttribute('data-part', 'more-button');
  root.appendChild(moreButtonEl);

  const unsub = sig.subscribe((s) => { root.setAttribute('data-state', s); });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default MessageActions;
