/* ---------------------------------------------------------------------------
 * HitlInterrupt — Vanilla implementation
 *
 * Human-in-the-loop interrupt dialog with approve, reject, modify, and fork
 * actions. Shows reason text, context, and state editor for modifications.
 * ------------------------------------------------------------------------- */

export type HitlInterruptState = 'pending' | 'editing' | 'approving' | 'rejecting' | 'forking';
export type HitlInterruptEvent =
  | { type: 'APPROVE' }
  | { type: 'REJECT' }
  | { type: 'MODIFY' }
  | { type: 'FORK' }
  | { type: 'SAVE' }
  | { type: 'CANCEL' }
  | { type: 'COMPLETE' }
  | { type: 'ERROR' };

export function hitlInterruptReducer(state: HitlInterruptState, event: HitlInterruptEvent): HitlInterruptState {
  switch (state) {
    case 'pending':
      if (event.type === 'APPROVE') return 'approving';
      if (event.type === 'REJECT') return 'rejecting';
      if (event.type === 'MODIFY') return 'editing';
      if (event.type === 'FORK') return 'forking';
      return state;
    case 'editing':
      if (event.type === 'SAVE') return 'pending';
      if (event.type === 'CANCEL') return 'pending';
      return state;
    case 'approving':
      if (event.type === 'COMPLETE') return 'resolved' as any;
      if (event.type === 'ERROR') return 'pending';
      return state;
    case 'rejecting':
      if (event.type === 'COMPLETE') return 'resolved' as any;
      return state;
    case 'forking':
      if (event.type === 'COMPLETE') return 'resolved' as any;
      return state;
    default:
      return state;
  }
}

export interface HitlInterruptProps {
  [key: string]: unknown;
  className?: string;
  reason?: string;
  risk?: 'low' | 'medium' | 'high' | 'critical';
  context?: string;
  toolName?: string;
  onApprove?: () => void;
  onReject?: (reason?: string) => void;
  onModify?: (data: string) => void;
  onFork?: () => void;
}
export interface HitlInterruptOptions { target: HTMLElement; props: HitlInterruptProps; }

let _hitlInterruptUid = 0;

export class HitlInterrupt {
  private el: HTMLElement;
  private props: HitlInterruptProps;
  private state: HitlInterruptState = 'pending';
  private disposers: Array<() => void> = [];
  private editValue = '';

  constructor(options: HitlInterruptOptions) {
    this.props = { ...options.props };
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'hitl-interrupt');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'alertdialog');
    this.el.setAttribute('aria-label', 'Human review required');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'hitl-interrupt-' + (++_hitlInterruptUid);
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  send(type: string): void { this.state = hitlInterruptReducer(this.state, { type } as any); this.el.setAttribute('data-state', this.state); }
  update(props: Partial<HitlInterruptProps>): void { Object.assign(this.props, props); this.cleanup(); this.el.innerHTML = ''; this.render(); }
  destroy(): void { this.cleanup(); this.el.remove(); }
  private cleanup(): void { for (const d of this.disposers) d(); this.disposers = []; }
  private rerender(): void { this.cleanup(); this.el.innerHTML = ''; this.render(); }

  private render(): void {
    const { reason = 'Action requires approval', risk = 'medium', context = '', toolName = '' } = this.props;
    this.el.setAttribute('data-state', this.state);
    this.el.setAttribute('data-risk', risk);
    if (this.props.className) this.el.className = this.props.className;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.state === 'editing') { e.preventDefault(); this.send('CANCEL'); this.rerender(); }
    };
    this.el.addEventListener('keydown', onKeyDown);
    this.disposers.push(() => this.el.removeEventListener('keydown', onKeyDown));

    // Header
    const header = document.createElement('div');
    header.setAttribute('data-part', 'header');
    header.setAttribute('data-risk', risk);
    const riskBadge = document.createElement('span');
    riskBadge.setAttribute('data-part', 'risk-badge');
    riskBadge.textContent = `\u26A0 ${risk.toUpperCase()}`;
    header.appendChild(riskBadge);
    if (toolName) {
      const toolEl = document.createElement('span');
      toolEl.setAttribute('data-part', 'tool-name');
      toolEl.textContent = toolName;
      header.appendChild(toolEl);
    }
    this.el.appendChild(header);

    // Reason
    const reasonText = document.createElement('div');
    reasonText.setAttribute('data-part', 'reason-text');
    reasonText.textContent = reason;
    this.el.appendChild(reasonText);

    // Context
    if (context) {
      const contextBlock = document.createElement('div');
      contextBlock.setAttribute('data-part', 'context-input');
      const pre = document.createElement('pre');
      pre.textContent = context;
      contextBlock.appendChild(pre);
      this.el.appendChild(contextBlock);
    }

    if (this.state === 'editing') {
      // State editor
      const editor = document.createElement('div');
      editor.setAttribute('data-part', 'state-editor');
      const textarea = document.createElement('textarea');
      textarea.setAttribute('aria-label', 'Edit action data');
      textarea.setAttribute('rows', '4');
      textarea.value = this.editValue;
      const onInput = () => { this.editValue = textarea.value; };
      textarea.addEventListener('input', onInput);
      this.disposers.push(() => textarea.removeEventListener('input', onInput));
      editor.appendChild(textarea);

      const saveBtn = document.createElement('button');
      saveBtn.setAttribute('type', 'button');
      saveBtn.setAttribute('data-part', 'save-button');
      saveBtn.textContent = 'Save';
      const onSave = () => { this.send('SAVE'); this.props.onModify?.(this.editValue); this.rerender(); };
      saveBtn.addEventListener('click', onSave);
      this.disposers.push(() => saveBtn.removeEventListener('click', onSave));
      editor.appendChild(saveBtn);

      const cancelBtn = document.createElement('button');
      cancelBtn.setAttribute('type', 'button');
      cancelBtn.setAttribute('data-part', 'cancel-edit');
      cancelBtn.textContent = 'Cancel';
      const onCancel = () => { this.send('CANCEL'); this.rerender(); };
      cancelBtn.addEventListener('click', onCancel);
      this.disposers.push(() => cancelBtn.removeEventListener('click', onCancel));
      editor.appendChild(cancelBtn);
      this.el.appendChild(editor);
    } else if (this.state === 'pending') {
      // Action bar
      const actionBar = document.createElement('div');
      actionBar.setAttribute('data-part', 'action-bar');
      actionBar.setAttribute('role', 'toolbar');

      const approveBtn = document.createElement('button');
      approveBtn.setAttribute('data-part', 'approve-button');
      approveBtn.setAttribute('type', 'button');
      approveBtn.setAttribute('aria-label', 'Approve');
      approveBtn.textContent = 'Approve';
      const onApprove = () => { this.send('APPROVE'); this.props.onApprove?.(); this.send('COMPLETE'); this.rerender(); };
      approveBtn.addEventListener('click', onApprove);
      this.disposers.push(() => approveBtn.removeEventListener('click', onApprove));
      actionBar.appendChild(approveBtn);

      const rejectBtn = document.createElement('button');
      rejectBtn.setAttribute('data-part', 'reject-button');
      rejectBtn.setAttribute('type', 'button');
      rejectBtn.setAttribute('aria-label', 'Reject');
      rejectBtn.textContent = 'Reject';
      const onReject = () => { this.send('REJECT'); this.props.onReject?.(); this.send('COMPLETE'); this.rerender(); };
      rejectBtn.addEventListener('click', onReject);
      this.disposers.push(() => rejectBtn.removeEventListener('click', onReject));
      actionBar.appendChild(rejectBtn);

      const modifyBtn = document.createElement('button');
      modifyBtn.setAttribute('data-part', 'modify-button');
      modifyBtn.setAttribute('type', 'button');
      modifyBtn.setAttribute('aria-label', 'Modify');
      modifyBtn.textContent = 'Modify';
      const onModify = () => { this.send('MODIFY'); this.rerender(); };
      modifyBtn.addEventListener('click', onModify);
      this.disposers.push(() => modifyBtn.removeEventListener('click', onModify));
      actionBar.appendChild(modifyBtn);

      const forkBtn = document.createElement('button');
      forkBtn.setAttribute('data-part', 'fork-button');
      forkBtn.setAttribute('type', 'button');
      forkBtn.setAttribute('aria-label', 'Fork');
      forkBtn.textContent = 'Fork';
      const onFork = () => { this.send('FORK'); this.props.onFork?.(); this.send('COMPLETE'); this.rerender(); };
      forkBtn.addEventListener('click', onFork);
      this.disposers.push(() => forkBtn.removeEventListener('click', onFork));
      actionBar.appendChild(forkBtn);

      this.el.appendChild(actionBar);
    }
  }
}

export default HitlInterrupt;
