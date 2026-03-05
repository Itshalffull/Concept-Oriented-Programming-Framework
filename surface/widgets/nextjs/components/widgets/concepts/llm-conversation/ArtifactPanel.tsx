/* ---------------------------------------------------------------------------
 * ArtifactPanel — Server Component
 *
 * Side panel for displaying and interacting with generated artifacts
 * (code, documents, images, HTML). Supports version navigation.
 * ------------------------------------------------------------------------- */

import type { ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Constants
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

export interface ArtifactPanelProps {
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
  /** Optional override for the content area. */
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Content renderer
 * ------------------------------------------------------------------------- */

function renderArtifactContent(
  artifactType: string,
  content: string,
  title: string,
  language?: string,
  children?: ReactNode,
) {
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
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function ArtifactPanel({
  content,
  artifactType,
  title,
  language,
  showVersions = true,
  defaultWidth = '50%',
  resizable = true,
  currentVersion = 1,
  totalVersions = 1,
  children,
}: ArtifactPanelProps) {
  const typeIcon = TYPE_ICONS[artifactType] ?? '';
  const typeLabel = TYPE_LABELS[artifactType] ?? artifactType;
  const showVersionBar = showVersions && totalVersions > 1;

  return (
    <div
      role="complementary"
      aria-label={`Artifact: ${title}`}
      data-surface-widget=""
      data-widget-name="artifact-panel"
      data-part="root"
      data-state="open"
      data-type={artifactType}
      tabIndex={0}
      style={{
        width: defaultWidth,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Resize drag handle (left edge) */}
      {resizable && (
        <div
          data-part="resize-handle"
          aria-hidden="true"
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
        data-state="open"
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
          data-state="open"
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
          data-state="open"
          role="toolbar"
          aria-label="Artifact actions"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            data-part="copy-button"
            data-state="idle"
            aria-label="Copy artifact content to clipboard"
            tabIndex={0}
          >
            Copy
          </button>

          <button
            type="button"
            data-part="download-button"
            aria-label="Download artifact as file"
            tabIndex={0}
          >
            Download
          </button>

          <button
            type="button"
            data-part="fullscreen-button"
            data-state="idle"
            aria-label="Enter fullscreen"
            tabIndex={0}
          >
            Fullscreen
          </button>

          <button
            type="button"
            data-part="close-button"
            data-state="open"
            aria-label="Close artifact panel"
            tabIndex={0}
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
          >
            &rsaquo;
          </button>
        </div>
      )}

      {/* Content area */}
      <div
        data-part="content"
        data-state="open"
        data-type={artifactType}
        role="region"
        aria-label="Artifact content"
        style={{
          flex: 1,
          overflow: 'auto',
        }}
      >
        {renderArtifactContent(artifactType, content, title, language, children)}
      </div>
    </div>
  );
}

export { ArtifactPanel };
