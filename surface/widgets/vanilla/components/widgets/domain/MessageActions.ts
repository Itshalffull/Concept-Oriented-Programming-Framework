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

export interface MessageActionsProps { [key: string]: unknown; className?: string; }
export interface MessageActionsOptions { target: HTMLElement; props: MessageActionsProps; }

let _messageActionsUid = 0;

export class MessageActions {
  private el: HTMLElement;
  private props: MessageActionsProps;
  private state: MessageActionsState = 'hidden';

  constructor(options: MessageActionsOptions) {
    this.props = { ...options.props };
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'message-actions');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'toolbar');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'message-actions-' + (++_messageActionsUid);
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  send(type: string): void {
    this.state = messageActionsReducer(this.state, { type } as any);
    this.el.setAttribute('data-state', this.state);
  }

  update(props: Partial<MessageActionsProps>): void {
    Object.assign(this.props, props);
    this.el.innerHTML = '';
    this.render();
  }

  destroy(): void { this.el.remove(); }

  private render(): void {
    this.el.setAttribute('data-state', this.state);
    if (this.props.className) this.el.className = this.props.className as string;
    const thumbsUp = document.createElement('button');
    thumbsUp.setAttribute('data-part', 'thumbs-up');
    this.el.appendChild(thumbsUp);
    const thumbsDown = document.createElement('button');
    thumbsDown.setAttribute('data-part', 'thumbs-down');
    this.el.appendChild(thumbsDown);
    const copyButton = document.createElement('button');
    copyButton.setAttribute('data-part', 'copy-button');
    this.el.appendChild(copyButton);
    const regenerate = document.createElement('button');
    regenerate.setAttribute('data-part', 'regenerate');
    this.el.appendChild(regenerate);
    const editButton = document.createElement('button');
    editButton.setAttribute('data-part', 'edit-button');
    this.el.appendChild(editButton);
    const shareButton = document.createElement('button');
    shareButton.setAttribute('data-part', 'share-button');
    this.el.appendChild(shareButton);
    const moreButton = document.createElement('button');
    moreButton.setAttribute('data-part', 'more-button');
    this.el.appendChild(moreButton);
  }
}

export default MessageActions;
