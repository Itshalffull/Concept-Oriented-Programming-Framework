import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type MessageBranchNavState = 'viewing' | 'editing';
export type MessageBranchNavEvent =
  | { type: 'PREV' }
  | { type: 'NEXT' }
  | { type: 'EDIT' }
  | { type: 'SAVE' }
  | { type: 'CANCEL' };

export function messageBranchNavReducer(state: MessageBranchNavState, event: MessageBranchNavEvent): MessageBranchNavState {
  switch (state) {
    case 'viewing':
      if (event.type === 'PREV') return 'viewing';
      if (event.type === 'NEXT') return 'viewing';
      if (event.type === 'EDIT') return 'editing';
      return state;
    case 'editing':
      if (event.type === 'SAVE') return 'viewing';
      if (event.type === 'CANCEL') return 'viewing';
      return state;
    default:
      return state;
  }
}

export interface MessageBranchNavProps { [key: string]: unknown; class?: string; }
export interface MessageBranchNavResult { element: HTMLElement; dispose: () => void; }

export function MessageBranchNav(props: MessageBranchNavProps): MessageBranchNavResult {
  const sig = surfaceCreateSignal<MessageBranchNavState>('viewing');
  const state = () => sig.get();
  const send = (type: string) => sig.set(messageBranchNavReducer(sig.get(), { type } as any));

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'message-branch-nav');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'navigation');
  root.setAttribute('aria-label', 'Branch navigation');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); send('PREV'); }
    if (e.key === 'ArrowRight') { e.preventDefault(); send('NEXT'); }
    if (e.key === 'e' && sig.get() === 'viewing') { e.preventDefault(); send('EDIT'); }
    if (e.key === 'Escape' && sig.get() === 'editing') { e.preventDefault(); send('CANCEL'); }
  });

  const prevButtonEl = document.createElement('button');
  prevButtonEl.setAttribute('type', 'button');
  prevButtonEl.setAttribute('data-part', 'prev-button');
  prevButtonEl.setAttribute('aria-label', 'Previous version');
  prevButtonEl.setAttribute('tabindex', '0');
  prevButtonEl.innerHTML = '&#9664;';
  prevButtonEl.addEventListener('click', () => send('PREV'));
  root.appendChild(prevButtonEl);

  const indicatorEl = document.createElement('span');
  indicatorEl.setAttribute('data-part', 'indicator');
  root.appendChild(indicatorEl);

  const nextButtonEl = document.createElement('button');
  nextButtonEl.setAttribute('type', 'button');
  nextButtonEl.setAttribute('data-part', 'next-button');
  nextButtonEl.setAttribute('aria-label', 'Next version');
  nextButtonEl.setAttribute('tabindex', '0');
  nextButtonEl.innerHTML = '&#9654;';
  nextButtonEl.addEventListener('click', () => send('NEXT'));
  root.appendChild(nextButtonEl);

  const editButtonEl = document.createElement('button');
  editButtonEl.setAttribute('type', 'button');
  editButtonEl.setAttribute('data-part', 'edit-button');
  editButtonEl.setAttribute('aria-label', 'Edit and branch');
  editButtonEl.setAttribute('tabindex', '0');
  editButtonEl.innerHTML = '&#9998;';
  editButtonEl.addEventListener('click', () => send('EDIT'));
  root.appendChild(editButtonEl);

  const saveButtonEl = document.createElement('button');
  saveButtonEl.setAttribute('type', 'button');
  saveButtonEl.setAttribute('data-part', 'save-button');
  saveButtonEl.setAttribute('aria-label', 'Save edit');
  saveButtonEl.setAttribute('tabindex', '0');
  saveButtonEl.innerHTML = '&#10003;';
  saveButtonEl.style.display = 'none';
  saveButtonEl.addEventListener('click', () => send('SAVE'));
  root.appendChild(saveButtonEl);

  const cancelButtonEl = document.createElement('button');
  cancelButtonEl.setAttribute('type', 'button');
  cancelButtonEl.setAttribute('data-part', 'cancel-button');
  cancelButtonEl.setAttribute('aria-label', 'Cancel edit');
  cancelButtonEl.setAttribute('tabindex', '0');
  cancelButtonEl.innerHTML = '&#10005;';
  cancelButtonEl.style.display = 'none';
  cancelButtonEl.addEventListener('click', () => send('CANCEL'));
  root.appendChild(cancelButtonEl);

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    prevButtonEl.setAttribute('data-state', s);
    indicatorEl.setAttribute('data-state', s);
    nextButtonEl.setAttribute('data-state', s);
    editButtonEl.setAttribute('data-state', s);
    editButtonEl.style.display = s === 'viewing' ? '' : 'none';
    saveButtonEl.setAttribute('data-state', s);
    saveButtonEl.style.display = s === 'editing' ? '' : 'none';
    cancelButtonEl.setAttribute('data-state', s);
    cancelButtonEl.style.display = s === 'editing' ? '' : 'none';
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default MessageBranchNav;
