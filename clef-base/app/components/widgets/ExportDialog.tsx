'use client';

/**
 * ExportDialog — React adapter for the export-dialog.widget spec.
 *
 * Surfaces four export targets for a ContentNode page:
 *   - Markdown  — ContentSerializer/serialize(format:"markdown") → .md download
 *   - HTML      — ContentSerializer/serialize(format:"html")     → .html download
 *   - PDF       — browser window.print() with page-CSS applied
 *   - JSON      — ContentSerializer/serialize(format:"json")     → .json download
 *
 * All text targets (Markdown, HTML, JSON) also offer "Copy to clipboard".
 *
 * Scope:
 *   - page-only           — serialize only the root ContentNode
 *   - page-with-children  — serialize root + all Outline descendants
 *
 * ContentSerializer/serialize is invoked via useKernelInvoke following the
 * ActionBinding/invoke pattern used throughout this codebase. If the kernel
 * does not have ContentSerializer registered, the call returns a non-ok
 * variant and the error is surfaced inline without crashing.
 *
 * Widget spec: surface/widgets/export-dialog.widget
 * PRD card:    PP-export-dialog (5f37e323-3273-48b2-9b11-ac93071b530e)
 *
 * Gap note: ContentSerializer concept is not yet shipped as of this card.
 * When it is absent, serialize calls return { variant: 'notfound' } (or
 * equivalent) and the dialog surfaces "Export not available" rather than
 * crashing. This is intentional — the dialog skeleton ships ahead of the
 * concept so the keyboard binding and UI are available immediately.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExportFormat = 'markdown' | 'html' | 'pdf' | 'json';
type ExportScope  = 'page-only' | 'page-with-children';
type OperationState = 'idle' | 'exporting' | 'copying' | 'copied' | 'error';

const FORMAT_META: Record<ExportFormat, { label: string; hint: string; ext: string; mime: string }> = {
  markdown: { label: 'Markdown',  hint: 'Plain text with formatting syntax (.md)',    ext: 'md',   mime: 'text/markdown' },
  html:     { label: 'HTML',      hint: 'Standalone web page (.html)',                ext: 'html', mime: 'text/html' },
  pdf:      { label: 'PDF',       hint: 'Print to PDF via browser dialog',            ext: 'pdf',  mime: '' },
  json:     { label: 'JSON',      hint: 'Structured block tree data (.json)',          ext: 'json', mime: 'application/json' },
};

const SCOPE_META: Record<ExportScope, { label: string; description: string }> = {
  'page-only':           { label: 'Current page',         description: 'Export this page only'          },
  'page-with-children':  { label: 'Page + child pages',   description: 'Include all nested child pages' },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ExportDialogProps {
  /** ContentNode ID of the page being exported. */
  nodeId: string;
  /** Human-readable title of the page — used to derive the download filename. */
  title?: string;
  /** Called when the dialog requests closure (Escape or close button). */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ExportDialog: React.FC<ExportDialogProps> = ({
  nodeId,
  title = 'document',
  onClose,
}) => {
  const invoke = useKernelInvoke();

  const [format, setFormat]     = useState<ExportFormat>('markdown');
  const [scope, setScope]       = useState<ExportScope>('page-only');
  const [operation, setOp]      = useState<OperationState>('idle');
  const [statusMsg, setStatus]  = useState<string>('');

  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up the "Copied!" auto-reset timer on unmount
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Serialize via ContentSerializer/serialize (or ActionBinding fallback)
  // ---------------------------------------------------------------------------

  const serializeContent = useCallback(async (): Promise<string | null> => {
    // Attempt ContentSerializer/serialize if available
    try {
      const result = await invoke('ContentSerializer', 'serialize', {
        node:     nodeId,
        format,
        recursive: scope === 'page-with-children',
      });

      if (result.variant === 'ok') {
        const raw = result.content ?? result.output ?? result.result;
        return typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
      }

      // Non-ok but not a throw — concept may exist but returned an error variant.
      // Fall through to the local fallback.
      console.warn('[ExportDialog] ContentSerializer/serialize returned non-ok:', result.variant);
    } catch {
      // ContentSerializer not registered — fall through to local fallback
    }

    // -----------------------------------------------------------------------
    // Local fallback: collect raw block data via Outline + ContentNode queries.
    // Produces a minimal but usable export when ContentSerializer is absent.
    // -----------------------------------------------------------------------
    try {
      const blocks: Array<Record<string, unknown>> = [];

      const collectBlocks = async (parentId: string) => {
        const outlineResult = await invoke('Outline', 'children', { parent: parentId });
        const childIds: string[] = outlineResult.variant === 'ok'
          ? (typeof outlineResult.children === 'string'
              ? JSON.parse(outlineResult.children)
              : (outlineResult.children as string[] ?? []))
          : [];

        for (const childId of childIds) {
          try {
            const nodeResult = await invoke('ContentNode', 'get', { node: childId });
            if (nodeResult.variant === 'ok') {
              blocks.push({ id: childId, ...(nodeResult as Record<string, unknown>) });
            }
          } catch { /* non-fatal */ }

          if (scope === 'page-with-children') {
            await collectBlocks(childId);
          }
        }
      };

      const rootResult = await invoke('ContentNode', 'get', { node: nodeId });
      if (rootResult.variant === 'ok') {
        blocks.push({ id: nodeId, ...(rootResult as Record<string, unknown>) });
      }
      await collectBlocks(nodeId);

      if (format === 'json') {
        return JSON.stringify({ exportedAt: new Date().toISOString(), nodeId, blocks }, null, 2);
      }

      // Minimal Markdown/HTML from raw block data
      const lines = blocks.map((b) => {
        const text = String(b.text ?? b.title ?? b.name ?? b.id ?? '');
        return format === 'html' ? `<p>${escapeHtml(text)}</p>` : text;
      });

      if (format === 'html') {
        return `<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>\n<body>\n${lines.join('\n')}\n</body>\n</html>`;
      }

      return `# ${title}\n\n${lines.join('\n\n')}`;
    } catch (err) {
      console.error('[ExportDialog] Local fallback serialization failed:', err);
      return null;
    }
  }, [invoke, nodeId, format, scope, title]);

  // ---------------------------------------------------------------------------
  // Download handler
  // ---------------------------------------------------------------------------

  const handleDownload = useCallback(async () => {
    if (operation !== 'idle') return;

    if (format === 'pdf') {
      // PDF: inject print-CSS, call window.print(), then restore
      triggerPrintExport(title);
      return;
    }

    setOp('exporting');
    setStatus('Exporting…');

    const content = await serializeContent();
    if (content === null) {
      setOp('error');
      setStatus('Export failed — serializer unavailable.');
      return;
    }

    const meta = FORMAT_META[format];
    const filename = `${sanitizeFilename(title)}.${meta.ext}`;
    triggerBlobDownload(content, filename, meta.mime);

    setOp('idle');
    setStatus('');
  }, [operation, format, title, serializeContent]);

  // ---------------------------------------------------------------------------
  // Clipboard handler
  // ---------------------------------------------------------------------------

  const handleCopyToClipboard = useCallback(async () => {
    if (operation !== 'idle' || format === 'pdf') return;

    setOp('copying');
    setStatus('Copying…');

    const content = await serializeContent();
    if (content === null) {
      setOp('error');
      setStatus('Copy failed — serializer unavailable.');
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      setOp('copied');
      setStatus('Copied!');
      copiedTimerRef.current = setTimeout(() => {
        setOp('idle');
        setStatus('');
      }, 2000);
    } catch {
      setOp('error');
      setStatus('Could not access clipboard.');
    }
  }, [operation, format, serializeContent]);

  // ---------------------------------------------------------------------------
  // Keyboard: Escape closes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', onKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [onClose]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const busy = operation === 'exporting' || operation === 'copying';
  const downloadLabel =
    operation === 'exporting' ? 'Exporting…' :
    format === 'pdf' ? 'Print / Save as PDF' :
    `Download .${FORMAT_META[format].ext}`;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      data-part="root"
      data-state="open"
      data-format={format}
      data-scope={scope}
      data-operation={operation}
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-dialog-heading"
      style={{
        width: '420px',
        padding: 'var(--spacing-lg, 20px)',
        fontFamily: 'var(--font-body, sans-serif)',
        fontSize: '14px',
        color: 'var(--palette-on-surface, #1c1b1f)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-md, 16px)',
      }}
    >
      {/* Header */}
      <div
        data-part="header"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <h2
          id="export-dialog-heading"
          data-part="heading"
          style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}
        >
          Export document
        </h2>
        <button
          data-part="closeButton"
          aria-label="Close export dialog"
          onClick={onClose}
          style={ghostButtonStyle}
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div data-part="body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md, 16px)' }}>

        {/* Format section */}
        <section data-part="formatSection">
          <p
            data-part="formatSectionLabel"
            style={sectionLabelStyle}
          >
            Export as
          </p>
          <div role="radiogroup" aria-label="Export format" style={buttonGroupStyle}>
            {(Object.keys(FORMAT_META) as ExportFormat[]).map((fmt) => {
              const meta = FORMAT_META[fmt];
              const selected = format === fmt;
              return (
                <button
                  key={fmt}
                  data-part="formatButton"
                  data-format={fmt}
                  data-selected={selected ? 'true' : 'false'}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setFormat(fmt)}
                  style={formatButtonStyle(selected)}
                >
                  <span data-part="formatButtonLabel" style={{ fontWeight: 500 }}>
                    {meta.label}
                  </span>
                  <span data-part="formatButtonHint" style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>
                    {meta.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Scope section */}
        <section data-part="scopeSection">
          <p data-part="scopeSectionLabel" style={sectionLabelStyle}>
            Scope
          </p>
          <div role="radiogroup" aria-label="Export scope" style={{ display: 'flex', gap: 'var(--spacing-sm, 8px)' }}>
            {(Object.keys(SCOPE_META) as ExportScope[]).map((sc) => {
              const meta = SCOPE_META[sc];
              const selected = scope === sc;
              return (
                <button
                  key={sc}
                  data-part="scopeButton"
                  data-scope={sc}
                  data-selected={selected ? 'true' : 'false'}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setScope(sc)}
                  style={scopeButtonStyle(selected)}
                >
                  <span data-part="scopeButtonLabel" style={{ fontWeight: 500 }}>
                    {meta.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Include-children toggle (mirrors scope picker) */}
          <label
            data-part="includeChildrenRow"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', cursor: 'pointer' }}
          >
            <input
              data-part="includeChildrenToggle"
              type="checkbox"
              role="checkbox"
              checked={scope === 'page-with-children'}
              aria-checked={scope === 'page-with-children'}
              onChange={() =>
                setScope((prev) => prev === 'page-with-children' ? 'page-only' : 'page-with-children')
              }
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <span data-part="includeChildrenLabel">Include child pages</span>
          </label>
        </section>
      </div>

      {/* Status message */}
      {statusMsg && (
        <p
          data-part="statusMessage"
          role="status"
          aria-live="polite"
          style={{
            margin: 0,
            fontSize: '12px',
            color: operation === 'error'
              ? 'var(--palette-error, #b00020)'
              : operation === 'copied'
              ? 'var(--palette-success, #1a7a4a)'
              : 'var(--palette-on-surface-variant, #49454f)',
          }}
        >
          {statusMsg}
        </p>
      )}

      {/* Footer */}
      <div
        data-part="footer"
        style={{ display: 'flex', gap: 'var(--spacing-sm, 8px)', justifyContent: 'flex-end' }}
      >
        {/* Copy to clipboard — hidden for PDF */}
        {format !== 'pdf' && (
          <button
            data-part="clipboardButton"
            aria-label="Copy to clipboard"
            aria-disabled={busy}
            disabled={busy}
            onClick={handleCopyToClipboard}
            style={secondaryButtonStyle(busy)}
          >
            {operation === 'copying' ? 'Copying…' : operation === 'copied' ? 'Copied!' : 'Copy to clipboard'}
          </button>
        )}

        {/* Primary: download / print */}
        <button
          data-part="downloadButton"
          aria-label={downloadLabel}
          aria-disabled={busy}
          disabled={busy}
          onClick={handleDownload}
          style={primaryButtonStyle(busy)}
        >
          {downloadLabel}
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Utility: trigger a Blob download via an anchor click
// ---------------------------------------------------------------------------

function triggerBlobDownload(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ---------------------------------------------------------------------------
// Utility: trigger browser print with page-scoped CSS
// ---------------------------------------------------------------------------

function triggerPrintExport(title: string): void {
  // Inject a <style> element with print-only rules so the browser formats
  // the active page correctly when the user chooses "Save as PDF".
  const styleId = '__clef-export-print-css';
  let style = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = styleId;
    document.head.appendChild(style);
  }

  style.textContent = `
    @media print {
      /* Hide chrome: sidebars, toolbars, dialogs, overlays */
      [data-part="left-palette"],
      [data-part="right-rail"],
      [data-part="inline-toolbar"],
      [data-part="modal-stack-root"],
      [data-part="status-bar"],
      [data-part="header-slot"],
      nav, header, aside { display: none !important; }

      /* Let the center pane fill the page */
      [data-part="center-pane"] {
        width: 100% !important;
        max-width: 700px !important;
        margin: 0 auto !important;
        padding: 24px !important;
      }

      body { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; }
      h1, h2, h3 { page-break-after: avoid; }
      p { orphans: 3; widows: 3; }
      pre, code { font-size: 9pt; page-break-inside: avoid; }
    }
  `;

  // Update document title temporarily for the print dialog filename suggestion
  const prevTitle = document.title;
  document.title = title;
  window.print();
  document.title = prevTitle;

  // Clean up the injected style after print completes
  setTimeout(() => {
    style?.remove();
  }, 2000);
}

// ---------------------------------------------------------------------------
// Utility: sanitize a string for use as a filename
// ---------------------------------------------------------------------------

function sanitizeFilename(raw: string): string {
  return raw.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 120) || 'document';
}

// ---------------------------------------------------------------------------
// Utility: minimal HTML entity escaping
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Style helpers (inline — keeps the component self-contained)
// ---------------------------------------------------------------------------

const ghostButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: '4px',
  color: 'var(--palette-on-surface-variant, #49454f)',
  fontSize: '16px',
  lineHeight: 1,
};

const sectionLabelStyle: React.CSSProperties = {
  margin: '0 0 8px 0',
  fontSize: '12px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--palette-on-surface-variant, #49454f)',
};

const buttonGroupStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '8px',
};

function formatButtonStyle(selected: boolean): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: '10px 12px',
    border: `2px solid ${selected ? 'var(--palette-primary, #6750a4)' : 'var(--palette-outline-variant, #cac4d0)'}`,
    borderRadius: '8px',
    background: selected ? 'var(--palette-primary-container, #eaddff)' : 'var(--palette-surface, #fff)',
    color: selected ? 'var(--palette-on-primary-container, #21005d)' : 'var(--palette-on-surface, #1c1b1f)',
    cursor: 'pointer',
    textAlign: 'left',
    gap: '2px',
  };
}

function scopeButtonStyle(selected: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '8px 12px',
    border: `2px solid ${selected ? 'var(--palette-primary, #6750a4)' : 'var(--palette-outline-variant, #cac4d0)'}`,
    borderRadius: '8px',
    background: selected ? 'var(--palette-primary-container, #eaddff)' : 'var(--palette-surface, #fff)',
    color: selected ? 'var(--palette-on-primary-container, #21005d)' : 'var(--palette-on-surface, #1c1b1f)',
    cursor: 'pointer',
    fontWeight: selected ? 600 : 400,
  };
}

function primaryButtonStyle(busy: boolean): React.CSSProperties {
  return {
    padding: '8px 20px',
    borderRadius: '20px',
    border: 'none',
    background: busy ? 'var(--palette-outline-variant, #cac4d0)' : 'var(--palette-primary, #6750a4)',
    color: busy ? 'var(--palette-on-surface-variant, #49454f)' : 'var(--palette-on-primary, #fff)',
    cursor: busy ? 'not-allowed' : 'pointer',
    fontWeight: 600,
    fontSize: '14px',
  };
}

function secondaryButtonStyle(busy: boolean): React.CSSProperties {
  return {
    padding: '8px 16px',
    borderRadius: '20px',
    border: '1px solid var(--palette-outline-variant, #cac4d0)',
    background: 'var(--palette-surface, #fff)',
    color: busy ? 'var(--palette-on-surface-variant, #49454f)' : 'var(--palette-on-surface, #1c1b1f)',
    cursor: busy ? 'not-allowed' : 'pointer',
    fontSize: '14px',
  };
}
