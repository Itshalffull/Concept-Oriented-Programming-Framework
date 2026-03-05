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

import {
  forwardRef,
  useReducer,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

export interface MessageActionsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  messageId: string;
  showFeedback?: boolean;
  showRegenerate?: boolean;
  showEdit?: boolean;
  showShare?: boolean;
  children?: ReactNode;
}

const MessageActions = forwardRef<HTMLDivElement, MessageActionsProps>(function MessageActions(
  props,
  ref,
) {
  const [state, send] = useReducer(messageActionsReducer, 'hidden');

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Hover-revealed toolbar for chat message actions including th"
      data-surface-widget=""
      data-widget-name="message-actions"
      data-part="root"
      data-state={state}
      onKeyDown={(e) => {
        if (e.key === 'c') { e.preventDefault(); send({ type: 'COPY' }); }
        if (e.key === 'r') { e.preventDefault(); send({ type: 'REGENERATE' }); }
        if (e.key === 'e') { e.preventDefault(); send({ type: 'EDIT' }); }
      }}
      tabIndex={0}
      {...props}
    >
        <button
          type="button"
          data-part="thumbs-up"
          data-state={state}
          aria-label="Positive feedback button"
          tabIndex={0}
          onClick={() => send({ type: 'SHOW' })}
        >
          {props.children ?? 'Positive feedback button'}
        </button>
        <button
          type="button"
          data-part="thumbs-down"
          data-state={state}
          aria-label="Negative feedback button"
          tabIndex={0}
          onClick={() => send({ type: 'SHOW' })}
        >
          {props.children ?? 'Negative feedback button'}
        </button>
        <button
          type="button"
          data-part="copy-button"
          data-state={state}
          aria-label="Copy message content"
          tabIndex={0}
          onClick={() => send({ type: 'SHOW' })}
        >
          {props.children ?? 'Copy message content'}
        </button>
        <button
          type="button"
          data-part="regenerate"
          data-state={state}
          aria-label="Regenerate this response"
          tabIndex={0}
          onClick={() => send({ type: 'SHOW' })}
        >
          {props.children ?? 'Regenerate this response'}
        </button>
        <button
          type="button"
          data-part="edit-button"
          data-state={state}
          aria-label="Edit this message"
          tabIndex={0}
          onClick={() => send({ type: 'SHOW' })}
        >
          {props.children ?? 'Edit this message'}
        </button>
        <button
          type="button"
          data-part="share-button"
          data-state={state}
          aria-label="Share this message"
          tabIndex={0}
          onClick={() => send({ type: 'SHOW' })}
        >
          {props.children ?? 'Share this message'}
        </button>
        <button
          type="button"
          data-part="more-button"
          data-state={state}
          aria-label="Overflow menu for additional actions"
          tabIndex={0}
          onClick={() => send({ type: 'SHOW' })}
        >
          {props.children ?? 'Overflow menu for additional actions'}
        </button>
    </div>
  );
});

MessageActions.displayName = 'MessageActions';
export { MessageActions };
export default MessageActions;
