/**
 * smart-paste-converter.ts — paste handler that converts clipboard content
 * (text/markdown, text/html, text/plain) into block-tree nodes via
 * Outline/create + Schema/applyTo, inserting children under rootNodeId
 * starting after cursorBlockId.
 *
 * Parser: Syntax/parse(language:"markdown") kernel dispatch.
 *   The micromark-parse provider registered at boot handles the actual parse;
 *   this file no longer imports micromark directly — all dispatch goes through
 *   the kernel so the provider can be swapped without touching client code.
 *
 * Architecture note:
 *   Block insertion follows the same pattern as the slash-menu insert-block
 *   path in RecursiveBlockEditor.tsx: each new block is a new ContentNode
 *   created via ActionBinding/invoke 'insert-block' with a schema payload.
 *   The 'insert-block' ActionBinding is resolved at runtime by the kernel's
 *   ActionBinding store — no static seed entry is required here.
 *
 * Scope boundary:
 *   - This file: pure conversion + block insertion logic (no React imports)
 *   - RecursiveBlockEditor.tsx: wires handlePaste to call convertAndInsert
 *     BEFORE the existing image-paste path (image path is skipped when
 *     HTML/MD content is detected)
 *
 * Card: PP-smart-paste (id 40ee59db-a043-4d46-85d3-515254a10eb6)
 * LE-16 wiring: direct micromark import replaced with Syntax/parse dispatch.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A parsed block ready for insertion into the Clef Base block tree.
 * schema maps to ComponentMapping schema names:
 *   'heading' | 'paragraph' | 'bullet-list' | 'numbered-list' |
 *   'quote' | 'code' | 'media-asset' | 'table'
 */
export interface ParsedBlock {
  /** ComponentMapping schema name */
  schema: string;
  /** HTML content for rich text blocks */
  content: string;
  /** Schema-specific properties (level for heading, language for code, src for image) */
  meta: Record<string, unknown>;
}

/**
 * Context passed to convertAndInsert from RecursiveBlockEditor.
 */
export interface SmartPasteContext {
  rootNodeId: string;
  cursorBlockId: string | null;
  cursorPosition: number;
}

/**
 * Kernel invoke function type — matches the signature returned by
 * useKernelInvoke() in clef-provider.tsx.
 */
export type KernelInvokeFn = (
  concept: string,
  action: string,
  input: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when clipboard data contains text/html or text/markdown
 * with structural content worth converting (not just plain text wrapped
 * in a <p> or empty). Callers use this to decide whether to skip the
 * image-paste path.
 */
export function hasStructuredContent(clipboardData: DataTransfer): boolean {
  const html = clipboardData.getData('text/html');
  const md = clipboardData.getData('text/markdown') || clipboardData.getData('text/x-markdown');

  if (md && md.trim().length > 0) return true;

  if (html && html.trim().length > 0) {
    // Check for structural HTML tags that indicate non-trivial content
    const structuralPattern = /<(h[1-6]|ul|ol|blockquote|pre|table|img)\b/i;
    return structuralPattern.test(html);
  }

  return false;
}

// ---------------------------------------------------------------------------
// Markdown → ParsedBlock[]
// ---------------------------------------------------------------------------

/**
 * Escape HTML entities for safe insertion into block content strings.
 */
function escHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Convert Markdown source to a ParsedBlock array via Syntax/parse kernel dispatch.
 *
 * Strategy: dispatch to Syntax/parse(language:"markdown", text) so the
 * registered micromark-parse provider handles the actual parse.  The returned
 * AST bytes are a micromark-rendered HTML string (provider contract), which we
 * then pass to parseHtmlToBlocks.  Falls back to parsePlainTextToBlocks when
 * the kernel call fails or the provider is absent.
 *
 * This function is async because it dispatches through the kernel; callers
 * (convertAndInsert) are already async.
 */
export async function parseMarkdownToBlocks(
  markdown: string,
  invoke: KernelInvokeFn,
): Promise<ParsedBlock[]> {
  if (!markdown.trim()) return [];

  try {
    const result = await invoke('Syntax', 'parse', {
      language: 'markdown',
      text: markdown,
    });

    if (result.variant === 'ok') {
      // The micromark-parse provider returns rendered HTML as the ast bytes string.
      const html = typeof result.ast === 'string' ? result.ast : '';
      if (html) {
        const blocks = parseHtmlToBlocks(html);
        if (blocks.length > 0) return blocks;
      }
    }
    // no_provider or error — fall through to plain-text split
    if (result.variant !== 'no_provider') {
      console.warn('[smart-paste] Syntax/parse non-ok variant:', result.variant);
    }
  } catch (err) {
    console.warn('[smart-paste] Syntax/parse dispatch failed, falling back:', err);
  }

  // Fallback: split on double newlines into paragraphs
  return parsePlainTextToBlocks(markdown);
}

// ---------------------------------------------------------------------------
// HTML → ParsedBlock[]
// ---------------------------------------------------------------------------

/**
 * Convert an HTML string to a ParsedBlock array using DOMParser.
 *
 * Handles:
 *   <h1>–<h6>  → heading (level 1–6)
 *   <ul>/<ol>   → bullet-list / numbered-list (one block per <li>)
 *   <blockquote>→ quote
 *   <pre><code> → code (with optional language class)
 *   <img>       → media-asset (src carried in meta)
 *   <table>     → table (serialised as HTML string in content)
 *   <p>         → paragraph
 *
 * Falls back to paragraph for any unrecognised element that has text.
 */
export function parseHtmlToBlocks(html: string): ParsedBlock[] {
  if (typeof window === 'undefined') {
    // SSR guard — can only run on the client where DOMParser is available
    return [{ schema: 'paragraph', content: escHtml(html.replace(/<[^>]*>/g, '')), meta: {} }];
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;

  const blocks: ParsedBlock[] = [];

  function processNode(node: Element): void {
    const tag = node.tagName.toLowerCase();

    // Headings
    const headingMatch = tag.match(/^h([1-6])$/);
    if (headingMatch) {
      const level = parseInt(headingMatch[1], 10);
      blocks.push({
        schema: 'heading',
        content: node.innerHTML.trim(),
        meta: { level },
      });
      return;
    }

    // Unordered list
    if (tag === 'ul') {
      const items = Array.from(node.querySelectorAll(':scope > li'));
      for (const li of items) {
        blocks.push({
          schema: 'bullet-list',
          content: extractListItemContent(li),
          meta: {},
        });
      }
      return;
    }

    // Ordered list
    if (tag === 'ol') {
      const items = Array.from(node.querySelectorAll(':scope > li'));
      for (const li of items) {
        blocks.push({
          schema: 'numbered-list',
          content: extractListItemContent(li),
          meta: {},
        });
      }
      return;
    }

    // Blockquote — use inner text, strip nested blockquote wrappers
    if (tag === 'blockquote') {
      const text = node.textContent?.trim() ?? '';
      if (text) {
        blocks.push({ schema: 'quote', content: escHtml(text), meta: {} });
      }
      return;
    }

    // Code block — <pre><code> or bare <pre>
    if (tag === 'pre') {
      const codeEl = node.querySelector('code');
      const rawText = (codeEl ?? node).textContent ?? '';
      const language = extractCodeLanguage(codeEl ?? node);
      blocks.push({
        schema: 'code',
        content: escHtml(rawText),
        meta: language ? { language } : {},
      });
      return;
    }

    // Bare <code> outside of <pre> — inline code turned into a code block
    if (tag === 'code') {
      const rawText = node.textContent ?? '';
      blocks.push({ schema: 'code', content: escHtml(rawText), meta: {} });
      return;
    }

    // Image
    if (tag === 'img') {
      const src = node.getAttribute('src') ?? '';
      const alt = node.getAttribute('alt') ?? '';
      if (src) {
        blocks.push({ schema: 'media-asset', content: '', meta: { src, alt } });
      }
      return;
    }

    // Table — serialise the outer HTML into the block content so the
    // table-block widget can render it. The table widget is responsible
    // for further parsing.
    if (tag === 'table') {
      blocks.push({
        schema: 'table',
        content: node.outerHTML,
        meta: {},
      });
      return;
    }

    // Paragraph — preserve inner HTML for inline marks (bold, italic, links)
    if (tag === 'p') {
      const inner = node.innerHTML.trim();
      if (inner) {
        // Check for an <img> inside the paragraph — emit as image block
        const imgEl = node.querySelector('img');
        if (imgEl && node.textContent?.trim() === '') {
          const src = imgEl.getAttribute('src') ?? '';
          const alt = imgEl.getAttribute('alt') ?? '';
          if (src) {
            blocks.push({ schema: 'media-asset', content: '', meta: { src, alt } });
            return;
          }
        }
        blocks.push({ schema: 'paragraph', content: inner, meta: {} });
      }
      return;
    }

    // div, section, article, main — recurse into children
    if (['div', 'section', 'article', 'main', 'body'].includes(tag)) {
      for (const child of Array.from(node.children)) {
        processNode(child as Element);
      }
      return;
    }

    // Fallback: if node has text content, emit a paragraph
    const text = node.textContent?.trim();
    if (text) {
      blocks.push({ schema: 'paragraph', content: escHtml(text), meta: {} });
    }
  }

  // Walk top-level children of <body>
  for (const child of Array.from(body.children)) {
    processNode(child as Element);
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Plain text → ParsedBlock[]
// ---------------------------------------------------------------------------

/**
 * Split plain text on double newlines into paragraph blocks.
 * Each non-empty paragraph becomes one paragraph block.
 */
export function parsePlainTextToBlocks(text: string): ParsedBlock[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return [];
  return paragraphs.map((p) => ({
    schema: 'paragraph',
    content: escHtml(p.replace(/\n/g, '<br>')),
    meta: {},
  }));
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract the inline content of a list item, skipping nested <ul>/<ol>
 * so that nested lists produce flat blocks rather than escaped HTML.
 * Inline marks (<strong>, <em>, <code>, <a>) are preserved.
 */
function extractListItemContent(li: Element): string {
  // Clone the li, remove nested lists, return innerHTML
  const clone = li.cloneNode(true) as Element;
  for (const nested of Array.from(clone.querySelectorAll('ul, ol'))) {
    nested.parentNode?.removeChild(nested);
  }
  return clone.innerHTML.trim();
}

/**
 * Extract language hint from a <code> element's class list.
 * Supports class="language-typescript", "lang-ts", "highlight-python", etc.
 */
function extractCodeLanguage(el: Element): string | null {
  const classes = Array.from(el.classList);
  for (const cls of classes) {
    const m = cls.match(/^(?:language|lang|highlight)-(.+)$/);
    if (m) return m[1].toLowerCase();
  }
  return null;
}

// ---------------------------------------------------------------------------
// Block insertion via kernel ActionBinding
// ---------------------------------------------------------------------------

/**
 * Insert a sequence of ParsedBlocks into the Clef Base block tree.
 *
 * Each block is inserted via:
 *   ActionBinding/invoke 'insert-block' — creates a new ContentNode with
 *   the given schema, sets content via ContentNode/setContent (if the binding
 *   supports it through parameterMap), and adds it as an Outline child.
 *
 * After all insertions, returns the count of successfully inserted blocks.
 * Partial failures are logged as warnings but do not abort the sequence.
 */
export async function insertParsedBlocks(
  blocks: ParsedBlock[],
  ctx: SmartPasteContext,
  invoke: KernelInvokeFn,
): Promise<number> {
  if (blocks.length === 0) return 0;

  let inserted = 0;

  for (const block of blocks) {
    try {
      const context = JSON.stringify({
        rootNodeId: ctx.rootNodeId,
        schema: block.schema,
        displayMode: 'block-editor',
        content: block.content,
        meta: block.meta,
        afterBlockId: ctx.cursorBlockId ?? null,
      });

      const result = await invoke('ActionBinding', 'invoke', {
        binding: 'insert-block',
        context,
      });

      if (result.variant === 'ok') {
        inserted++;
        // Update cursor to insert subsequent blocks after this one.
        // The newly inserted block's id may be carried in result.nodeId;
        // fall back to keeping cursorBlockId unchanged if not available.
        if (typeof result.nodeId === 'string' && result.nodeId) {
          ctx = { ...ctx, cursorBlockId: result.nodeId };
        }
      } else {
        console.warn(
          '[smart-paste] insert-block returned non-ok variant:',
          result.variant,
          'schema:', block.schema,
        );
      }
    } catch (err) {
      console.error('[smart-paste] insert-block failed for schema:', block.schema, err);
    }
  }

  return inserted;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * convertAndInsert — called from RecursiveBlockEditor's onPaste handler.
 *
 * Priority order for clipboard MIME types:
 *   1. text/markdown (or text/x-markdown) — parse via micromark + GFM
 *   2. text/html — parse via DOMParser
 *   3. text/plain — split on double newlines into paragraphs
 *
 * Returns the number of blocks inserted (0 means nothing was converted —
 * caller should fall through to default paste behavior).
 *
 * Usage in RecursiveBlockEditor:
 *
 *   const count = await convertAndInsert(e.clipboardData, ctx, invoke);
 *   if (count > 0) {
 *     e.preventDefault();
 *     setTimeout(() => loadChildren(), 300);
 *   }
 *   // else: fall through to existing image-paste / default path
 */
export async function convertAndInsert(
  clipboardData: DataTransfer,
  ctx: SmartPasteContext,
  invoke: KernelInvokeFn,
): Promise<number> {
  // 1. Markdown — dispatch through Syntax/parse(language:"markdown")
  const md = clipboardData.getData('text/markdown') || clipboardData.getData('text/x-markdown');
  if (md && md.trim().length > 0) {
    const blocks = await parseMarkdownToBlocks(md, invoke);
    if (blocks.length > 0) {
      return insertParsedBlocks(blocks, ctx, invoke);
    }
  }

  // 2. HTML (with structural content check)
  const html = clipboardData.getData('text/html');
  if (html && html.trim().length > 0) {
    const structuralPattern = /<(h[1-6]|ul|ol|blockquote|pre|table|img)\b/i;
    if (structuralPattern.test(html)) {
      const blocks = parseHtmlToBlocks(html);
      if (blocks.length > 0) {
        return insertParsedBlocks(blocks, ctx, invoke);
      }
    }
  }

  // 3. Plain text — only convert when there are at least two paragraphs;
  //    single-paragraph plain text falls through to native paste.
  const plain = clipboardData.getData('text/plain');
  if (plain && /\n{2,}/.test(plain)) {
    const blocks = parsePlainTextToBlocks(plain);
    if (blocks.length > 1) {
      return insertParsedBlocks(blocks, ctx, invoke);
    }
  }

  // Single plain-text paragraph → let browser handle it natively
  return 0;
}
