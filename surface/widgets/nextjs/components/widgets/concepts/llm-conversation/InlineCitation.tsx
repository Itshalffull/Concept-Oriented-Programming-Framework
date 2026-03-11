/* ---------------------------------------------------------------------------
 * InlineCitation — Server Component
 *
 * Numbered inline citation reference rendered as a superscript badge
 * with tooltip showing source title, excerpt, and link.
 * ------------------------------------------------------------------------- */

import type { ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface InlineCitationProps {
  /** Citation number. */
  index: number;
  /** Source title. */
  title: string;
  /** Source URL. */
  url?: string | undefined;
  /** Relevant text excerpt. */
  excerpt?: string | undefined;
  /** Badge size. */
  size?: 'sm' | 'md';
  /** Show preview tooltip on hover. */
  showPreviewOnHover?: boolean;
  /** Optional children. */
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function InlineCitation({
  index,
  title,
  url,
  excerpt,
  size = 'sm',
  showPreviewOnHover: _showPreviewOnHover = true,
  children,
}: InlineCitationProps) {
  return (
    <span
      role="link"
      aria-label={`Citation ${index}: ${title}`}
      data-surface-widget=""
      data-widget-name="inline-citation"
      data-part="root"
      data-state="idle"
      tabIndex={0}
      style={{ position: 'relative', display: 'inline', cursor: 'pointer' }}
    >
      <sup
        data-part="badge"
        data-state="idle"
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
        role="tooltip"
        data-part="tooltip"
        data-state="idle"
        data-visible="false"
        aria-hidden="true"
        style={{
          display: 'none',
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
          data-state="idle"
          style={{ display: 'block', fontWeight: 600, marginBottom: excerpt ? '0.25em' : 0 }}
        >
          {title}
        </span>

        {excerpt && (
          <span
            data-part="excerpt"
            data-state="idle"
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
            data-state="idle"
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
}

export { InlineCitation };
