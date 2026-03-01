'use client';

import {
  forwardRef,
  useReducer,
  type HTMLAttributes,
} from 'react';

import { markdownReducer } from './MarkdownPreview.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface MarkdownPreviewProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Raw markdown source string. */
  source: string;
  /** Whether to sanitize output. */
  sanitize?: boolean;
  /** Accessible label. */
  ariaLabel?: string;
  /** Whether to apply syntax highlighting. */
  syntaxHighlight?: boolean;
  /** Target for links. */
  linkTarget?: '_self' | '_blank';
  /** Maximum height with overflow scroll. */
  maxHeight?: string;
  /** Custom markdown renderer. Returns HTML string. */
  renderMarkdown?: (source: string) => string;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const MarkdownPreview = forwardRef<HTMLDivElement, MarkdownPreviewProps>(
  function MarkdownPreview(
    {
      source,
      sanitize = true,
      ariaLabel = 'Markdown preview',
      syntaxHighlight = true,
      linkTarget = '_blank',
      maxHeight,
      renderMarkdown,
      className,
      ...rest
    },
    ref,
  ) {
    const [state] = useReducer(markdownReducer, 'static');

    const renderedHtml = renderMarkdown ? renderMarkdown(source) : source;

    return (
      <div
        ref={ref}
        role="document"
        aria-label={ariaLabel}
        aria-roledescription="markdown content"
        data-surface-widget=""
        data-widget-name="markdown-preview"
        data-part="markdown-preview"
        data-state={state}
        data-sanitized={sanitize ? 'true' : 'false'}
        data-syntax-highlight={syntaxHighlight ? 'true' : 'false'}
        tabIndex={0}
        className={className}
        style={{
          maxHeight: maxHeight || undefined,
          overflow: maxHeight ? 'auto' : 'visible',
        }}
        {...rest}
      >
        <div
          data-part="content"
          role="region"
          aria-label="Rendered content"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      </div>
    );
  },
);

MarkdownPreview.displayName = 'MarkdownPreview';
export { MarkdownPreview };
export default MarkdownPreview;
