// PDF ContentSerializer provider — implements the `pdf-serialize` provider
// id for target="pdf". Wraps the html provider's output in a print-ready
// document shell (with @page CSS rules for A4, margins, and page-break
// hints) and — when running in a browser — triggers the browser's native
// print dialog via a hidden iframe.
//
// Registration is driven by `syncs/app/register-content-serializers.sync`
// which dispatches ContentSerializer/register(provider: "pdf-serialize",
// target: "pdf") once PluginRegistry advertises the content-serializer
// plugin type at boot.
//
// Fidelity note: we cannot capture the PDF binary from `window.print()`,
// so this provider returns the print-ready HTML bytes. Callers in a
// server-side environment can hand the same bytes to Puppeteer or a
// similar headless-browser renderer to produce a true PDF binary.
// See docs/plans/block-editor-loose-ends-prd.md §6 (open question:
// server-side Puppeteer fidelity) and §LE-14 (this provider).

import {
  registerContentSerializerProvider,
  type ContentSerializerProviderFn,
} from './content-serializer-provider-registry.ts';
import { serializeHtml } from './content-serializer-html.provider.ts';

export const CONTENT_SERIALIZER_PROVIDER_ID = 'pdf-serialize';
export const CONTENT_SERIALIZER_TARGET = 'pdf';

type PdfConfig = {
  pageSize?: string;
  margin?: string;
  title?: string;
  autoPrint?: boolean;
};

function parseConfig(raw: string | undefined): PdfConfig {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return typeof v === 'object' && v !== null && !Array.isArray(v)
      ? v as PdfConfig
      : {};
  } catch {
    return {};
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapForPrint(innerHtml: string, config: PdfConfig): string {
  const pageSize = config.pageSize ?? 'A4';
  const margin = config.margin ?? '20mm';
  const title = config.title ?? 'Document';
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8"/>',
    `<title>${escapeHtml(title)}</title>`,
    '<style>',
    `@page { size: ${pageSize}; margin: ${margin}; }`,
    '@media print {',
    '  html, body { margin: 0; padding: 0; }',
    '  h1, h2, h3, h4, h5, h6 { page-break-after: avoid; break-after: avoid; }',
    '  h1, h2, h3 { page-break-before: auto; }',
    '  p, li, blockquote { orphans: 3; widows: 3; }',
    '  pre, table, blockquote, figure { page-break-inside: avoid; break-inside: avoid; }',
    '  img { max-width: 100%; page-break-inside: avoid; break-inside: avoid; }',
    '  tr, td, th { page-break-inside: avoid; break-inside: avoid; }',
    '  a { color: inherit; text-decoration: underline; }',
    '}',
    'body {',
    '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;',
    '  font-size: 11pt;',
    '  line-height: 1.5;',
    '  color: #111;',
    '}',
    'pre, code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10pt; }',
    'pre { background: #f4f4f4; padding: 0.75em; border-radius: 4px; overflow-x: auto; }',
    'blockquote { margin-left: 0; padding-left: 1em; border-left: 3px solid #ddd; color: #555; }',
    'table { border-collapse: collapse; width: 100%; }',
    'th, td { border: 1px solid #ccc; padding: 0.4em 0.6em; text-align: left; }',
    'hr { border: none; border-top: 1px solid #ccc; }',
    '</style>',
    '</head>',
    '<body>',
    innerHtml,
    '</body>',
    '</html>',
  ].join('\n');
}

function isBrowserEnvironment(): boolean {
  return typeof globalThis !== 'undefined'
    && typeof (globalThis as { window?: unknown }).window !== 'undefined'
    && typeof (globalThis as { document?: unknown }).document !== 'undefined';
}

function triggerBrowserPrint(html: string): void {
  try {
    const doc = (globalThis as unknown as {
      document: {
        createElement: (tag: string) => {
          style: { cssText: string };
          setAttribute: (k: string, v: string) => void;
          srcdoc?: string;
          contentWindow?: {
            document?: { open?: () => void; write?: (s: string) => void; close?: () => void };
            focus?: () => void;
            print?: () => void;
          };
          onload?: () => void;
        };
        body: {
          appendChild: (n: unknown) => void;
          removeChild: (n: unknown) => void;
        };
      };
    }).document;
    const iframe = doc.createElement('iframe');
    iframe.style.cssText =
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('tabindex', '-1');
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus?.();
        iframe.contentWindow?.print?.();
      } catch {
        // Swallow: user may cancel; caller still has the printable bytes.
      }
    };
    // Prefer srcdoc for same-origin isolation; fall back to doc.write.
    iframe.srcdoc = html;
    doc.body.appendChild(iframe);
    if (!iframe.srcdoc) {
      const cw = iframe.contentWindow;
      cw?.document?.open?.();
      cw?.document?.write?.(html);
      cw?.document?.close?.();
    }
  } catch {
    // Non-fatal: in hostile browser sandboxes (e.g. disabled iframe),
    // we still return the printable HTML so the caller can open it.
  }
}

export const serializePdf: ContentSerializerProviderFn = (
  rootNodeId,
  fetchNode,
  config,
) => {
  const cfg = parseConfig(config);
  const inner = serializeHtml(rootNodeId, fetchNode, undefined);
  // Detect soft-error envelope from the html provider and propagate it
  // unchanged — the PDF wrapper shouldn't swallow upstream errors.
  if (inner.startsWith('{')) {
    try {
      const maybe = JSON.parse(inner);
      if (maybe && typeof maybe === 'object' && maybe.ok === false) {
        return JSON.stringify({
          ok: false,
          target: CONTENT_SERIALIZER_TARGET,
          error: maybe.error ?? { message: 'html provider failed' },
        });
      }
    } catch {
      // Not a JSON envelope — treat as inline HTML, fall through.
    }
  }
  const html = wrapForPrint(inner, cfg);
  if (isBrowserEnvironment() && cfg.autoPrint !== false) {
    triggerBrowserPrint(html);
  }
  return html;
};

registerContentSerializerProvider(
  CONTENT_SERIALIZER_PROVIDER_ID,
  serializePdf,
);
