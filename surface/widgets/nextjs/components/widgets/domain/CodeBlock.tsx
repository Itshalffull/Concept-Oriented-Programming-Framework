'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useReducer,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { codeBlockReducer } from './CodeBlock.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface CodeBlockProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Source code content. */
  code: string;
  /** Programming language for syntax highlighting. */
  language?: string;
  /** Show line numbers. */
  showLineNumbers?: boolean;
  /** Lines to highlight (1-based). */
  highlightLines?: number[];
  /** Show the header bar with language + copy button. */
  showHeader?: boolean;
  /** Wrap long lines. */
  wrapLines?: boolean;
  /** Max height with scroll. */
  maxHeight?: string;
  /** Custom aria label. */
  ariaLabel?: string;
  /** Custom syntax highlighter. Returns highlighted HTML string. */
  highlightSyntax?: (code: string, language: string) => string;
  /** Custom copy button content. */
  copyIcon?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const CodeBlock = forwardRef<HTMLDivElement, CodeBlockProps>(function CodeBlock(
  {
    code,
    language = 'plaintext',
    showLineNumbers = true,
    highlightLines,
    showHeader = true,
    wrapLines = false,
    maxHeight,
    ariaLabel,
    highlightSyntax,
    copyIcon,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(codeBlockReducer, 'idle');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const lines = code.split('\n');

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* fallback: noop */
    }
    send({ type: 'COPY' });
  }, [code]);

  useEffect(() => {
    if (state === 'copied') {
      timerRef.current = setTimeout(() => send({ type: 'COPY_TIMEOUT' }), 2000);
      return () => clearTimeout(timerRef.current);
    }
  }, [state]);

  const renderedCode = highlightSyntax ? highlightSyntax(code, language) : undefined;

  return (
    <div
      ref={ref}
      role="region"
      aria-label={ariaLabel ?? `${language} code block`}
      aria-roledescription="code block"
      data-surface-widget=""
      data-widget-name="code-block"
      data-part="code-block"
      data-language={language}
      data-state={state}
      data-line-numbers={showLineNumbers ? 'true' : 'false'}
      data-wrap={wrapLines ? 'true' : 'false'}
      style={{
        maxHeight: maxHeight || undefined,
        overflow: maxHeight ? 'auto' : 'visible',
      }}
      onPointerEnter={() => send({ type: 'HOVER' })}
      onPointerLeave={() => send({ type: 'UNHOVER' })}
      onFocus={() => send({ type: 'FOCUS' })}
      onBlur={() => send({ type: 'BLUR' })}
      {...rest}
    >
      {showHeader && (
        <div data-part="header" data-visible="true">
          <span data-part="language" aria-label={`Language: ${language}`}>
            {language}
          </span>
          <button
            type="button"
            role="button"
            aria-label={state === 'copied' ? 'Copied to clipboard' : 'Copy code to clipboard'}
            aria-live="polite"
            data-part="copy-button"
            data-state={state === 'copied' ? 'copied' : 'idle'}
            tabIndex={0}
            onClick={handleCopy}
          >
            {copyIcon ?? (state === 'copied' ? 'Copied!' : 'Copy')}
          </button>
        </div>
      )}

      <div data-part="code-container" style={{ display: 'flex' }}>
        {showLineNumbers && (
          <div data-part="line-numbers" data-visible="true" aria-hidden="true" data-count={lines.length}>
            {lines.map((_, i) => (
              <span key={i} data-part="line-number">
                {i + 1}
              </span>
            ))}
          </div>
        )}

        <pre data-part="pre" data-wrap={wrapLines ? 'true' : 'false'}>
          {renderedCode ? (
            <code
              role="code"
              data-part="code"
              aria-label={`${language} source code`}
              aria-readonly="true"
              data-language={language}
              data-wrap={wrapLines ? 'true' : 'false'}
              tabIndex={0}
              dangerouslySetInnerHTML={{ __html: renderedCode }}
            />
          ) : (
            <code
              role="code"
              data-part="code"
              aria-label={`${language} source code`}
              aria-readonly="true"
              data-language={language}
              data-wrap={wrapLines ? 'true' : 'false'}
              tabIndex={0}
            >
              {lines.map((line, i) => (
                <span
                  key={i}
                  data-part="code-line"
                  data-highlighted={highlightLines?.includes(i + 1) ? 'true' : 'false'}
                >
                  {line}
                  {'\n'}
                </span>
              ))}
            </code>
          )}
        </pre>
      </div>
    </div>
  );
});

CodeBlock.displayName = 'CodeBlock';
export { CodeBlock };
export default CodeBlock;
