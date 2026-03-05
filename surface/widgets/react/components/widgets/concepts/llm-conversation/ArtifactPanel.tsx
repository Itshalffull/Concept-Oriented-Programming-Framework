/* ---------------------------------------------------------------------------
 * ArtifactPanel state machine
 * States: open (initial), copied, fullscreen, closed
 * See widget spec: artifact-panel.widget
 * ------------------------------------------------------------------------- */

export type ArtifactPanelState = 'open' | 'copied' | 'fullscreen' | 'closed';
export type ArtifactPanelEvent =
  | { type: 'COPY' }
  | { type: 'FULLSCREEN' }
  | { type: 'CLOSE' }
  | { type: 'VERSION_CHANGE' }
  | { type: 'COPY_TIMEOUT' }
  | { type: 'EXIT_FULLSCREEN' }
  | { type: 'OPEN' };

export function artifactPanelReducer(state: ArtifactPanelState, event: ArtifactPanelEvent): ArtifactPanelState {
  switch (state) {
    case 'open':
      if (event.type === 'COPY') return 'copied';
      if (event.type === 'FULLSCREEN') return 'fullscreen';
      if (event.type === 'CLOSE') return 'closed';
      if (event.type === 'VERSION_CHANGE') return 'open';
      return state;
    case 'copied':
      if (event.type === 'COPY_TIMEOUT') return 'open';
      return state;
    case 'fullscreen':
      if (event.type === 'EXIT_FULLSCREEN') return 'open';
      if (event.type === 'CLOSE') return 'closed';
      return state;
    case 'closed':
      if (event.type === 'OPEN') return 'open';
      return state;
    default:
      return state;
  }
}

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useReducer,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

/* ---------------------------------------------------------------------------
 * Type icon map
 * ------------------------------------------------------------------------- */

const TYPE_ICONS: Record<string, string> = {
  code: '\u{1F4BB}',
  document: '\u{1F4C4}',
  image: '\u{1F5BC}',
  html: '\u{1F310}',
};

const TYPE_LABELS: Record<string, string> = {
  code: 'Code',
  document: 'Document',
  image: 'Image',
  html: 'HTML',
};

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface ArtifactPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'content'> {
  /** The artifact content string. */
  content: string;
  /** Artifact type determines rendering mode. */
  artifactType: 'code' | 'document' | 'image' | 'html';
  /** Artifact title displayed in the header. */
  title: string;
  /** Programming language label for code artifacts. */
  language?: string;
  /** Whether to show the version bar. */
  showVersions?: boolean;
  /** Default panel width (CSS value). */
  defaultWidth?: string;
  /** Whether the panel is resizable via drag handle. */
  resizable?: boolean;
  /** Current version number (1-based). */
  currentVersion?: number;
  /** Total number of versions. */
  totalVersions?: number;
  /** Callback when version changes. */
  onVersionChange?: (version: number) => void;
  /** Callback when panel is closed. */
  onClose?: () => void;
  /** Callback after content is copied. */
  onCopy?: () => void;
  /** Callback when download is requested. */
  onDownload?: () => void;
  /** Optional override for the content area. */
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Minimum / maximum panel widths for resize
 * ------------------------------------------------------------------------- */

const MIN_WIDTH_PX = 280;
const MAX_WIDTH_PX = 1200;

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const ArtifactPanel = forwardRef<HTMLDivElement, ArtifactPanelProps>(function ArtifactPanel(
  {
    content,
    artifactType,
    title,
    language,
    showVersions = true,
    defaultWidth = '50%',
    resizable = true,
    currentVersion = 1,
    totalVersions = 1,
    onVersionChange,
    onClose,
    onCopy,
    onDownload,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(artifactPanelReducer, 'open');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelWidth, setPanelWidth] = useState<string>(defaultWidth);
  const resizingRef = useRef(false);

  /* Merge forwarded ref with local ref */
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      panelRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [ref],
  );

  /* Copy timeout: return to open after 2 seconds */
  useEffect(() => {
    if (state === 'copied') {
      timerRef.current = setTimeout(() => send({ type: 'COPY_TIMEOUT' }), 2000);
      return () => clearTimeout(timerRef.current);
    }
  }, [state]);

  /* Notify parent on close */
  useEffect(() => {
    if (state === 'closed') {
      onClose?.();
    }
  }, [state, onClose]);

  /* Copy handler with clipboard API */
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      /* fallback: noop */
    }
    send({ type: 'COPY' });
    onCopy?.();
  }, [content, onCopy]);

  /* Download handler */
  const handleDownload = useCallback(() => {
    const extensionMap: Record<string, string> = {
      code: language ?? 'txt',
      document: 'txt',
      image: 'png',
      html: 'html',
    };
    const ext = extensionMap[artifactType] ?? 'txt';
    const mimeMap: Record<string, string> = {
      code: 'text/plain',
      document: 'text/plain',
      image: 'application/octet-stream',
      html: 'text/html',
    };
    const mime = mimeMap[artifactType] ?? 'text/plain';

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    onDownload?.();
  }, [content, artifactType, title, language, onDownload]);

  /* Keyboard handler */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (state === 'fullscreen') {
          send({ type: 'EXIT_FULLSCREEN' });
        } else {
          send({ type: 'CLOSE' });
        }
      }
      if (e.ctrlKey && !e.shiftKey && e.key === 'c') {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
          e.preventDefault();
          handleCopy();
        }
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        if (state === 'fullscreen') {
          send({ type: 'EXIT_FULLSCREEN' });
        } else {
          send({ type: 'FULLSCREEN' });
        }
      }
    },
    [handleCopy, state],
  );

  /* Resize drag handle */
  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!resizable) return;
      e.preventDefault();
      resizingRef.current = true;
      const startX = e.clientX;
      const startWidth = panelRef.current?.getBoundingClientRect().width ?? 400;

      const onPointerMove = (moveEvent: PointerEvent) => {
        if (!resizingRef.current) return;
        const delta = moveEvent.clientX - startX;
        const newWidth = Math.min(MAX_WIDTH_PX, Math.max(MIN_WIDTH_PX, startWidth + delta));
        setPanelWidth(`${newWidth}px`);
      };

      const onPointerUp = () => {
        resizingRef.current = false;
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
      };

      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    },
    [resizable],
  );

  /* Version navigation */
  const handleVersionPrev = useCallback(() => {
    if (currentVersion > 1) {
      send({ type: 'VERSION_CHANGE' });
      onVersionChange?.(currentVersion - 1);
    }
  }, [currentVersion, onVersionChange]);

  const handleVersionNext = useCallback(() => {
    if (currentVersion < totalVersions) {
      send({ type: 'VERSION_CHANGE' });
      onVersionChange?.(currentVersion + 1);
    }
  }, [currentVersion, totalVersions, onVersionChange]);

  /* Don't render when closed */
  if (state === 'closed') {
    return null;
  }

  const typeIcon = TYPE_ICONS[artifactType] ?? '';
  const typeLabel = TYPE_LABELS[artifactType] ?? artifactType;
  const showVersionBar = showVersions && totalVersions > 1;

  /* Content rendering based on artifact type */
  const renderContent = () => {
    if (children) return children;

    switch (artifactType) {
      case 'code':
        return (
          <pre
            data-part="code-pre"
            style={{
              margin: 0,
              padding: '12px',
              overflow: 'auto',
              fontSize: '13px',
              lineHeight: 1.5,
              fontFamily: 'monospace',
            }}
          >
            {language && (
              <span
                data-part="language-label"
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  opacity: 0.6,
                }}
              >
                {language}
              </span>
            )}
            <code data-part="code-content" data-language={language}>
              {content}
            </code>
          </pre>
        );

      case 'document':
        return (
          <div
            data-part="document-content"
            style={{
              padding: '16px',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {content}
          </div>
        );

      case 'image':
        return (
          <div
            data-part="image-wrapper"
            style={{
              padding: '16px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <img
              src={content}
              alt={title}
              data-part="image-content"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
              }}
            />
          </div>
        );

      case 'html':
        return (
          <div
            data-part="html-preview-notice"
            style={{
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <span
              style={{
                fontSize: '13px',
                opacity: 0.7,
                fontStyle: 'italic',
              }}
            >
              HTML preview is sandboxed for security. Raw HTML is not rendered directly.
            </span>
            <pre
              style={{
                margin: 0,
                padding: '12px',
                overflow: 'auto',
                fontSize: '13px',
                lineHeight: 1.5,
                fontFamily: 'monospace',
              }}
            >
              <code>{content}</code>
            </pre>
          </div>
        );

      default:
        return (
          <div data-part="fallback-content" style={{ padding: '16px' }}>
            {content}
          </div>
        );
    }
  };

  return (
    <div
      ref={setRefs}
      role="complementary"
      aria-label={`Artifact: ${title}`}
      data-surface-widget=""
      data-widget-name="artifact-panel"
      data-part="root"
      data-state={state}
      data-type={artifactType}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        width: state === 'fullscreen' ? '100%' : panelWidth,
        height: state === 'fullscreen' ? '100vh' : undefined,
        position: state === 'fullscreen' ? 'fixed' : 'relative',
        top: state === 'fullscreen' ? 0 : undefined,
        left: state === 'fullscreen' ? 0 : undefined,
        zIndex: state === 'fullscreen' ? 9999 : undefined,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...(rest.style ?? {}),
      }}
      {...rest}
    >
      {/* Resize drag handle (left edge) */}
      {resizable && state !== 'fullscreen' && (
        <div
          data-part="resize-handle"
          aria-hidden="true"
          onPointerDown={handleResizePointerDown}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '4px',
            height: '100%',
            cursor: 'col-resize',
            zIndex: 1,
          }}
        />
      )}

      {/* Header */}
      <div
        data-part="header"
        data-state={state}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          flexShrink: 0,
        }}
      >
        {/* Type badge */}
        <span
          data-part="type-badge"
          aria-label={`Type: ${typeLabel}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
          }}
        >
          <span aria-hidden="true">{typeIcon}</span>
          {typeLabel}
        </span>

        {/* Title */}
        <span
          data-part="title"
          data-state={state}
          style={{
            flex: 1,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>

        {/* Toolbar */}
        <div
          data-part="toolbar"
          data-state={state}
          role="toolbar"
          aria-label="Artifact actions"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            flexShrink: 0,
          }}
        >
          {/* Copy button */}
          <button
            type="button"
            data-part="copy-button"
            data-state={state === 'copied' ? 'copied' : 'idle'}
            aria-label={state === 'copied' ? 'Copied to clipboard' : 'Copy artifact content to clipboard'}
            aria-live="polite"
            tabIndex={0}
            onClick={handleCopy}
          >
            {state === 'copied' ? 'Copied!' : 'Copy'}
          </button>

          {/* Download button */}
          <button
            type="button"
            data-part="download-button"
            aria-label="Download artifact as file"
            tabIndex={0}
            onClick={handleDownload}
          >
            Download
          </button>

          {/* Fullscreen toggle */}
          <button
            type="button"
            data-part="fullscreen-button"
            data-state={state === 'fullscreen' ? 'active' : 'idle'}
            aria-label={state === 'fullscreen' ? 'Exit fullscreen' : 'Enter fullscreen'}
            tabIndex={0}
            onClick={() =>
              state === 'fullscreen'
                ? send({ type: 'EXIT_FULLSCREEN' })
                : send({ type: 'FULLSCREEN' })
            }
          >
            {state === 'fullscreen' ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>

          {/* Close button */}
          <button
            type="button"
            data-part="close-button"
            data-state={state}
            aria-label="Close artifact panel"
            tabIndex={0}
            onClick={() => send({ type: 'CLOSE' })}
          >
            Close
          </button>
        </div>
      </div>

      {/* Version bar */}
      {showVersionBar && (
        <div
          data-part="version-bar"
          data-visible="true"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 12px',
            fontSize: '12px',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            data-part="version-prev"
            aria-label="Previous version"
            tabIndex={0}
            disabled={currentVersion <= 1}
            onClick={handleVersionPrev}
          >
            &lsaquo;
          </button>
          <span data-part="version-indicator">
            Version {currentVersion} of {totalVersions}
          </span>
          <button
            type="button"
            data-part="version-next"
            aria-label="Next version"
            tabIndex={0}
            disabled={currentVersion >= totalVersions}
            onClick={handleVersionNext}
          >
            &rsaquo;
          </button>
        </div>
      )}

      {/* Content area */}
      <div
        data-part="content"
        data-state={state}
        data-type={artifactType}
        role="region"
        aria-label="Artifact content"
        style={{
          flex: 1,
          overflow: 'auto',
        }}
      >
        {renderContent()}
      </div>
    </div>
  );
});

ArtifactPanel.displayName = 'ArtifactPanel';
export { ArtifactPanel };
export default ArtifactPanel;
