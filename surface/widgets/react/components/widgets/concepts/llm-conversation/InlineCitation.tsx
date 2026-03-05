export type InlineCitationState = 'idle' | 'previewing' | 'navigating';
export type InlineCitationEvent =
  | { type: 'HOVER' }
  | { type: 'CLICK' }
  | { type: 'LEAVE' }
  | { type: 'NAVIGATE_COMPLETE' };

export function inlineCitationReducer(state: InlineCitationState, event: InlineCitationEvent): InlineCitationState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER') return 'previewing';
      if (event.type === 'CLICK') return 'navigating';
      return state;
    case 'previewing':
      if (event.type === 'LEAVE') return 'idle';
      if (event.type === 'CLICK') return 'navigating';
      return state;
    case 'navigating':
      if (event.type === 'NAVIGATE_COMPLETE') return 'idle';
      return state;
    default:
      return state;
  }
}

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useReducer,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

export interface InlineCitationProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  index: number;
  title: string;
  url?: string | undefined;
  excerpt?: string | undefined;
  size?: "sm" | "md";
  showPreviewOnHover?: boolean;
  children?: ReactNode;
}

const InlineCitation = forwardRef<HTMLDivElement, InlineCitationProps>(function InlineCitation(
  { index, title, url, excerpt, size = 'sm', showPreviewOnHover = true, children, ...rest },
  ref,
) {
  const [state, send] = useReducer(inlineCitationReducer, 'idle');
  const tooltipId = useId();

  const handleOpen = useCallback(() => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    // Transition through navigating and immediately complete
    send({ type: 'CLICK' });
  }, [url]);

  // When entering the navigating state, auto-complete the navigation
  useEffect(() => {
    if (state === 'navigating') {
      send({ type: 'NAVIGATE_COMPLETE' });
    }
  }, [state]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpen();
    }
    if (e.key === 'Escape' && state === 'previewing') {
      e.preventDefault();
      send({ type: 'LEAVE' });
    }
  }, [handleOpen, state]);

  return (
    <span
      ref={ref}
      role="link"
      aria-label={`Citation ${index}: ${title}`}
      aria-describedby={tooltipId}
      data-surface-widget=""
      data-widget-name="inline-citation"
      data-part="root"
      data-state={state}
      tabIndex={0}
      onMouseEnter={() => showPreviewOnHover && send({ type: 'HOVER' })}
      onMouseLeave={() => send({ type: 'LEAVE' })}
      onFocus={() => showPreviewOnHover && send({ type: 'HOVER' })}
      onBlur={() => send({ type: 'LEAVE' })}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      style={{ position: 'relative', display: 'inline', cursor: 'pointer' }}
      {...rest}
    >
      <sup
        data-part="badge"
        data-state={state}
        data-size={size}
        style={{
          fontSize: size === 'sm' ? '0.65em' : '0.75em',
          lineHeight: 1,
          verticalAlign: 'super',
          padding: '0 0.15em',
          color: 'var(--citation-color, #2563eb)',
          textDecoration: 'underline',
          textDecorationStyle: 'dotted',
        }}
      >
        [{index}]
      </sup>

      <span
        id={tooltipId}
        role="tooltip"
        data-part="tooltip"
        data-state={state}
        data-visible={state === 'previewing' ? 'true' : 'false'}
        aria-hidden={state !== 'previewing' ? 'true' : 'false'}
        style={{
          display: state === 'previewing' ? 'block' : 'none',
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '0.5em',
          padding: '0.5em 0.75em',
          minWidth: '12em',
          maxWidth: '20em',
          background: 'var(--tooltip-bg, #1f2937)',
          color: 'var(--tooltip-color, #f9fafb)',
          borderRadius: '0.375em',
          fontSize: '0.8125rem',
          lineHeight: 1.4,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 10,
          pointerEvents: 'none',
          whiteSpace: 'normal',
        }}
      >
        <span
          data-part="title"
          data-state={state}
          style={{ display: 'block', fontWeight: 600, marginBottom: excerpt ? '0.25em' : 0 }}
        >
          {title}
        </span>

        {excerpt && (
          <span
            data-part="excerpt"
            data-state={state}
            data-visible="true"
            style={{
              display: 'block',
              opacity: 0.85,
              fontSize: '0.75rem',
              marginBottom: url ? '0.35em' : 0,
            }}
          >
            {excerpt}
          </span>
        )}

        {url && (
          <span
            data-part="link"
            data-state={state}
            data-url={url}
            style={{
              display: 'block',
              fontSize: '0.7rem',
              opacity: 0.7,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {url}
          </span>
        )}
      </span>

      {children}
    </span>
  );
});

InlineCitation.displayName = 'InlineCitation';
export { InlineCitation };
export default InlineCitation;
