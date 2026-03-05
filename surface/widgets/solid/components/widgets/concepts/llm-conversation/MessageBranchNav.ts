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
  const send = (event: MessageBranchNavEvent) => { sig.set(messageBranchNavReducer(sig.get(), event)); };

  const currentIndex = Number(props.currentIndex ?? 0);
  const totalBranches = Number(props.totalBranches ?? 1);
  const showEdit = props.showEdit !== false;
  const compact = Boolean(props.compact);
  const onPrevBranch = props.onPrevBranch as (() => void) | undefined;
  const onNextBranch = props.onNextBranch as (() => void) | undefined;
  const onEdit = props.onEdit as (() => void) | undefined;
  const onSave = props.onSave as (() => void) | undefined;
  const onCancel = props.onCancel as (() => void) | undefined;

  const isFirst = currentIndex <= 0;
  const isLast = currentIndex >= totalBranches - 1;
  const displayIndex = currentIndex + 1;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'message-branch-nav');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('role', 'navigation');
  root.setAttribute('aria-label', `Branch ${displayIndex} of ${totalBranches}`);
  root.setAttribute('tabindex', '0');
  if (compact) root.setAttribute('data-compact', '');
  if (props.class) root.className = props.class as string;

  // Prev button
  const prevBtn = document.createElement('button');
  prevBtn.setAttribute('type', 'button');
  prevBtn.setAttribute('data-part', 'prev');
  prevBtn.setAttribute('data-state', sig.get());
  prevBtn.setAttribute('aria-label', 'Previous version');
  prevBtn.setAttribute('aria-disabled', isFirst ? 'true' : 'false');
  prevBtn.disabled = isFirst;
  prevBtn.setAttribute('tabindex', '0');
  prevBtn.innerHTML = '&#9664;';
  prevBtn.addEventListener('click', () => {
    if (isFirst) return;
    send({ type: 'PREV' });
    onPrevBranch?.();
  });
  root.appendChild(prevBtn);

  // Indicator
  const indicatorEl = document.createElement('span');
  indicatorEl.setAttribute('data-part', 'indicator');
  indicatorEl.setAttribute('data-state', sig.get());
  indicatorEl.textContent = `${displayIndex} / ${totalBranches}`;
  root.appendChild(indicatorEl);

  // Next button
  const nextBtn = document.createElement('button');
  nextBtn.setAttribute('type', 'button');
  nextBtn.setAttribute('data-part', 'next');
  nextBtn.setAttribute('data-state', sig.get());
  nextBtn.setAttribute('aria-label', 'Next version');
  nextBtn.setAttribute('aria-disabled', isLast ? 'true' : 'false');
  nextBtn.disabled = isLast;
  nextBtn.setAttribute('tabindex', '0');
  nextBtn.innerHTML = '&#9654;';
  nextBtn.addEventListener('click', () => {
    if (isLast) return;
    send({ type: 'NEXT' });
    onNextBranch?.();
  });
  root.appendChild(nextBtn);

  // Edit button (viewing state)
  const editBtn = document.createElement('button');
  editBtn.setAttribute('type', 'button');
  editBtn.setAttribute('data-part', 'edit');
  editBtn.setAttribute('data-state', sig.get());
  editBtn.setAttribute('aria-label', 'Edit and branch');
  editBtn.setAttribute('tabindex', '0');
  editBtn.innerHTML = '&#9998;';
  editBtn.style.display = showEdit ? '' : 'none';
  editBtn.addEventListener('click', () => {
    send({ type: 'EDIT' });
    onEdit?.();
  });
  root.appendChild(editBtn);

  // Save button (editing state)
  const saveBtn = document.createElement('button');
  saveBtn.setAttribute('type', 'button');
  saveBtn.setAttribute('data-part', 'save');
  saveBtn.setAttribute('data-state', sig.get());
  saveBtn.setAttribute('aria-label', 'Save edit');
  saveBtn.setAttribute('tabindex', '0');
  saveBtn.innerHTML = '&#10003;';
  saveBtn.style.display = 'none';
  saveBtn.addEventListener('click', () => {
    send({ type: 'SAVE' });
    onSave?.();
  });
  root.appendChild(saveBtn);

  // Cancel button (editing state)
  const cancelBtn = document.createElement('button');
  cancelBtn.setAttribute('type', 'button');
  cancelBtn.setAttribute('data-part', 'cancel');
  cancelBtn.setAttribute('data-state', sig.get());
  cancelBtn.setAttribute('aria-label', 'Cancel edit');
  cancelBtn.setAttribute('tabindex', '0');
  cancelBtn.innerHTML = '&#10005;';
  cancelBtn.style.display = 'none';
  cancelBtn.addEventListener('click', () => {
    send({ type: 'CANCEL' });
    onCancel?.();
  });
  root.appendChild(cancelBtn);

  // Keyboard
  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); if (!isFirst) { send({ type: 'PREV' }); onPrevBranch?.(); } }
    if (e.key === 'ArrowRight') { e.preventDefault(); if (!isLast) { send({ type: 'NEXT' }); onNextBranch?.(); } }
    if (e.key === 'e' && sig.get() === 'viewing') { e.preventDefault(); send({ type: 'EDIT' }); onEdit?.(); }
    if (e.key === 'Escape' && sig.get() === 'editing') { e.preventDefault(); send({ type: 'CANCEL' }); onCancel?.(); }
  });

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    editBtn.style.display = (showEdit && s === 'viewing') ? '' : 'none';
    saveBtn.style.display = s === 'editing' ? '' : 'none';
    cancelBtn.style.display = s === 'editing' ? '' : 'none';
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default MessageBranchNav;
