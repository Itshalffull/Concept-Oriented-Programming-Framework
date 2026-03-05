/* ---------------------------------------------------------------------------
 * MessageBranchNav — Vanilla implementation
 *
 * Navigates between message branches with prev/next buttons, index indicator,
 * and edit mode for modifying branch content.
 * ------------------------------------------------------------------------- */

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

export interface MessageBranchNavProps {
  [key: string]: unknown;
  className?: string;
  currentIndex?: number;
  totalBranches?: number;
  editContent?: string;
  onPrev?: () => void;
  onNext?: () => void;
  onEdit?: () => void;
  onSave?: (content: string) => void;
  onCancel?: () => void;
}
export interface MessageBranchNavOptions { target: HTMLElement; props: MessageBranchNavProps; }

let _messageBranchNavUid = 0;

export class MessageBranchNav {
  private el: HTMLElement;
  private props: MessageBranchNavProps;
  private state: MessageBranchNavState = 'viewing';
  private disposers: Array<() => void> = [];
  private editValue = '';

  constructor(options: MessageBranchNavOptions) {
    this.props = { ...options.props };
    this.editValue = (this.props.editContent as string) ?? '';
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'message-branch-nav');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'navigation');
    this.el.setAttribute('aria-label', 'Message branches');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'message-branch-nav-' + (++_messageBranchNavUid);
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  send(type: string): void {
    this.state = messageBranchNavReducer(this.state, { type } as any);
    this.el.setAttribute('data-state', this.state);
  }

  update(props: Partial<MessageBranchNavProps>): void {
    Object.assign(this.props, props);
    if (props.editContent !== undefined) this.editValue = props.editContent as string;
    this.cleanup();
    this.el.innerHTML = '';
    this.render();
  }

  destroy(): void { this.cleanup(); this.el.remove(); }

  private cleanup(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers = [];
  }

  private rerender(): void { this.cleanup(); this.el.innerHTML = ''; this.render(); }

  private render(): void {
    const { currentIndex = 0, totalBranches = 1 } = this.props;
    this.el.setAttribute('data-state', this.state);
    if (this.props.className) this.el.className = this.props.className;

    const onKeyDown = (e: KeyboardEvent) => {
      if (this.state === 'editing') {
        if (e.key === 'Escape') { e.preventDefault(); this.send('CANCEL'); this.props.onCancel?.(); this.rerender(); }
        return;
      }
      if (e.key === 'ArrowLeft' && currentIndex > 0) { e.preventDefault(); this.props.onPrev?.(); }
      if (e.key === 'ArrowRight' && currentIndex < totalBranches - 1) { e.preventDefault(); this.props.onNext?.(); }
      if (e.key === 'e') { e.preventDefault(); this.send('EDIT'); this.props.onEdit?.(); this.rerender(); }
    };
    this.el.addEventListener('keydown', onKeyDown);
    this.disposers.push(() => this.el.removeEventListener('keydown', onKeyDown));

    if (this.state === 'viewing') {
      const prevBtn = document.createElement('button');
      prevBtn.setAttribute('data-part', 'prev-button'); prevBtn.setAttribute('type', 'button');
      prevBtn.setAttribute('aria-label', 'Previous branch'); prevBtn.textContent = '\u2190';
      if (currentIndex <= 0) prevBtn.setAttribute('disabled', '');
      const onPrev = () => this.props.onPrev?.();
      prevBtn.addEventListener('click', onPrev);
      this.disposers.push(() => prevBtn.removeEventListener('click', onPrev));
      this.el.appendChild(prevBtn);

      const indicator = document.createElement('span');
      indicator.setAttribute('data-part', 'indicator'); indicator.setAttribute('role', 'status');
      indicator.textContent = `${currentIndex + 1} / ${totalBranches}`;
      this.el.appendChild(indicator);

      const nextBtn = document.createElement('button');
      nextBtn.setAttribute('data-part', 'next-button'); nextBtn.setAttribute('type', 'button');
      nextBtn.setAttribute('aria-label', 'Next branch'); nextBtn.textContent = '\u2192';
      if (currentIndex >= totalBranches - 1) nextBtn.setAttribute('disabled', '');
      const onNext = () => this.props.onNext?.();
      nextBtn.addEventListener('click', onNext);
      this.disposers.push(() => nextBtn.removeEventListener('click', onNext));
      this.el.appendChild(nextBtn);

      const editBtn = document.createElement('button');
      editBtn.setAttribute('data-part', 'edit-button'); editBtn.setAttribute('type', 'button');
      editBtn.setAttribute('aria-label', 'Edit branch'); editBtn.textContent = 'Edit';
      const onEditClick = () => { this.send('EDIT'); this.props.onEdit?.(); this.rerender(); };
      editBtn.addEventListener('click', onEditClick);
      this.disposers.push(() => editBtn.removeEventListener('click', onEditClick));
      this.el.appendChild(editBtn);
    } else {
      const textarea = document.createElement('textarea');
      textarea.setAttribute('data-part', 'edit-input'); textarea.setAttribute('aria-label', 'Edit message content');
      textarea.setAttribute('rows', '4'); textarea.value = this.editValue;
      const onInput = () => { this.editValue = textarea.value; };
      textarea.addEventListener('input', onInput);
      this.disposers.push(() => textarea.removeEventListener('input', onInput));
      this.el.appendChild(textarea);

      const saveBtn = document.createElement('button');
      saveBtn.setAttribute('data-part', 'save-button'); saveBtn.setAttribute('type', 'button');
      saveBtn.textContent = 'Save';
      const onSave = () => { this.props.onSave?.(this.editValue); this.send('SAVE'); this.rerender(); };
      saveBtn.addEventListener('click', onSave);
      this.disposers.push(() => saveBtn.removeEventListener('click', onSave));
      this.el.appendChild(saveBtn);

      const cancelBtn = document.createElement('button');
      cancelBtn.setAttribute('data-part', 'cancel-button'); cancelBtn.setAttribute('type', 'button');
      cancelBtn.textContent = 'Cancel';
      const onCancel = () => { this.send('CANCEL'); this.props.onCancel?.(); this.rerender(); };
      cancelBtn.addEventListener('click', onCancel);
      this.disposers.push(() => cancelBtn.removeEventListener('click', onCancel));
      this.el.appendChild(cancelBtn);
    }
  }
}

export default MessageBranchNav;
