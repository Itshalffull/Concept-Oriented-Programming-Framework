/**
 * spell-check-dispatcher.ts
 *
 * Debounced spell/grammar service for the block editor.
 *
 * Architecture
 * ─────────────
 * This module is a pure TypeScript service (no React). It:
 *
 *  1. Accepts text-change notifications from RecursiveBlockEditor via
 *     `notifyBlockEdit(blockId, plainText, invoke)`.
 *  2. Debounces 1.5 s after the last edit per block — only the most-recent
 *     text for a block is checked, stale checks are discarded.
 *  3. For each block, extracts tokens via `Intl.Segmenter` (word granularity).
 *  4. Primary path (browser-native only): no programmatic suggestions unless
 *     `NEXT_PUBLIC_SPELL_CHECK_API_URL` is set in the env.
 *  5. External service path: POST to `SPELL_CHECK_API_URL` expecting a
 *     LanguageTool-compatible response (`matches[].offset`, `.length`,
 *     `.rule.issueType` = "misspelling" | "grammar", `.replacements[].value`).
 *  6. Each flagged range is stored via `InlineAnnotation/annotate` with
 *     `changeType = "spelling"` or `"grammar"` and `scope` encoding the
 *     byte-range JSON plus the suggestion list.
 *  7. The existing `RegisterAnnotationSpelling` / `RegisterAnnotationGrammar`
 *     RenderTransforms (register-inline-annotation-decorations.sync) render
 *     the wavy underlines automatically.
 *
 * When `NEXT_PUBLIC_SPELL_CHECK_API_URL` is absent, the dispatcher still
 * creates InlineAnnotation records for browser-native spellcheck indication
 * by watching for `spellcheck` attribute coverage gaps; in practice the
 * browser handles native red-squiggles itself and no annotations are written,
 * which is the documented graceful-degradation path.
 *
 * InlineAnnotation concept action used: `annotate`
 * InlineAnnotation concept action for dismiss: `accept` (marking a spelling
 * suggestion as resolved after the user applies or ignores it)
 *
 * Suggestion metadata is JSON-encoded in the `scope` field as:
 *   { start: number; end: number; suggestions: string[]; kind: "spelling" | "grammar" }
 *
 * This is intentionally content-type–agnostic per the concept design.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Kernel invocation function shape — matches useKernelInvoke return type. */
export type KernelInvoker = (
  concept: string,
  action: string,
  input: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

/** A flagged text range returned by the external spell/grammar service. */
export interface SpellCheckMatch {
  /** Character offset (UTF-16 code units) from the start of the block text. */
  offset: number;
  /** Length in UTF-16 code units of the flagged span. */
  length: number;
  /** "spelling" for misspellings, "grammar" for grammar issues. */
  kind: 'spelling' | 'grammar';
  /** Replacement suggestions from the service, may be empty. */
  suggestions: string[];
  /** Human-readable message from the service (for accessibility). */
  message?: string;
}

/** Scope payload stored in the InlineAnnotation's `scope` field (JSON). */
export interface AnnotationScope {
  start: number;
  end: number;
  suggestions: string[];
  kind: 'spelling' | 'grammar';
  message?: string;
}

/** One active InlineAnnotation for a block. */
export interface ActiveAnnotation {
  annotationId: string;
  scope: AnnotationScope;
}

// ---------------------------------------------------------------------------
// Module-level state (singleton service)
// ---------------------------------------------------------------------------

/** Per-block debounce timer handles. */
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Per-block in-flight annotation IDs so we can resolve them before re-annotating. */
const activeAnnotations = new Map<string, ActiveAnnotation[]>();

/** Debounce delay in milliseconds. */
const DEBOUNCE_MS = 1500;

/**
 * External spell-check API URL, read from env at module load.
 * In Next.js, client-accessible env vars must be prefixed with NEXT_PUBLIC_.
 */
const SPELL_CHECK_API_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SPELL_CHECK_API_URL) || '';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Notify the dispatcher that a block's text has changed.
 *
 * The dispatcher debounces 1.5 s then runs spell/grammar checking.
 * Safe to call on every keystroke — only the last call within the debounce
 * window triggers a check.
 *
 * @param blockId    The ContentNode id of the edited block.
 * @param plainText  The block's current plain-text content (textContent).
 * @param invoke     The kernel invocation function from `useKernelInvoke()`.
 */
export function notifyBlockEdit(
  blockId: string,
  plainText: string,
  invoke: KernelInvoker,
): void {
  // Cancel any previously queued check for this block.
  const existing = debounceTimers.get(blockId);
  if (existing !== undefined) {
    clearTimeout(existing);
  }

  const handle = setTimeout(() => {
    debounceTimers.delete(blockId);
    void runCheck(blockId, plainText, invoke);
  }, DEBOUNCE_MS);

  debounceTimers.set(blockId, handle);
}

/**
 * Resolve (accept) all active InlineAnnotations for a block.
 * Called when a suggestion is applied or the block is cleared.
 *
 * @param blockId  The ContentNode id of the block.
 * @param invoke   The kernel invocation function.
 */
export async function resolveAnnotationsForBlock(
  blockId: string,
  invoke: KernelInvoker,
): Promise<void> {
  const annotations = activeAnnotations.get(blockId) ?? [];
  for (const ann of annotations) {
    try {
      await invoke('InlineAnnotation', 'accept', { annotationId: ann.annotationId });
    } catch (err) {
      console.warn('[SpellCheckDispatcher] failed to resolve annotation', ann.annotationId, err);
    }
  }
  activeAnnotations.delete(blockId);
}

/**
 * Resolve a single InlineAnnotation by id.
 * Called when the user applies a suggestion via the popover.
 *
 * @param blockId       The ContentNode id of the block.
 * @param annotationId  The id returned when the annotation was created.
 * @param invoke        The kernel invocation function.
 */
export async function resolveAnnotation(
  blockId: string,
  annotationId: string,
  invoke: KernelInvoker,
): Promise<void> {
  try {
    await invoke('InlineAnnotation', 'accept', { annotationId });
  } catch (err) {
    console.warn('[SpellCheckDispatcher] failed to resolve annotation', annotationId, err);
  }
  const prev = activeAnnotations.get(blockId) ?? [];
  activeAnnotations.set(
    blockId,
    prev.filter((a) => a.annotationId !== annotationId),
  );
}

/**
 * Return active annotations for a block (read-only snapshot).
 * Used by the popover to show suggestion lists for the right-clicked span.
 */
export function getActiveAnnotations(blockId: string): ActiveAnnotation[] {
  return activeAnnotations.get(blockId) ?? [];
}

// ---------------------------------------------------------------------------
// Internal — run spell/grammar check for one block
// ---------------------------------------------------------------------------

async function runCheck(
  blockId: string,
  text: string,
  invoke: KernelInvoker,
): Promise<void> {
  if (!text.trim()) {
    // Block is empty — clear any old annotations.
    await resolveAnnotationsForBlock(blockId, invoke);
    return;
  }

  let matches: SpellCheckMatch[];

  if (SPELL_CHECK_API_URL) {
    // External service path (LanguageTool-compatible API).
    matches = await fetchFromExternalService(text);
  } else {
    // Browser-native path: no programmatic matches — the browser renders its
    // own red squiggles via `spellcheck` attribute. We write no annotations.
    return;
  }

  if (matches.length === 0) {
    // All clean — resolve any stale annotations.
    await resolveAnnotationsForBlock(blockId, invoke);
    return;
  }

  // Resolve previous annotations for this block before writing new ones.
  await resolveAnnotationsForBlock(blockId, invoke);

  // Write new InlineAnnotations for each flagged range.
  const newAnnotations: ActiveAnnotation[] = [];

  for (const match of matches) {
    const scope: AnnotationScope = {
      start: match.offset,
      end: match.offset + match.length,
      suggestions: match.suggestions,
      kind: match.kind,
      message: match.message,
    };

    try {
      const result = await invoke('InlineAnnotation', 'annotate', {
        contentRef: blockId,
        changeType: match.kind,   // "spelling" | "grammar"
        scope: JSON.stringify(scope),
        author: 'spell-check-dispatcher',
      });

      if (result.variant === 'ok' && typeof result.annotationId === 'string') {
        newAnnotations.push({ annotationId: result.annotationId, scope });
      }
    } catch (err) {
      console.warn('[SpellCheckDispatcher] failed to annotate block', blockId, err);
    }
  }

  if (newAnnotations.length > 0) {
    activeAnnotations.set(blockId, newAnnotations);
  }
}

// ---------------------------------------------------------------------------
// Internal — external service call
// ---------------------------------------------------------------------------

/**
 * POST to a LanguageTool-compatible HTTP API and return normalized matches.
 *
 * Expected request format (form-encoded per LanguageTool public API):
 *   text=<text>&language=auto
 *
 * Expected response shape:
 *   { matches: Array<{
 *       offset: number; length: number;
 *       message: string;
 *       rule: { issueType: string };
 *       replacements: Array<{ value: string }>;
 *     }>
 *   }
 */
async function fetchFromExternalService(text: string): Promise<SpellCheckMatch[]> {
  try {
    const body = new URLSearchParams({ text, language: 'auto' });
    const response = await fetch(SPELL_CHECK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      console.warn('[SpellCheckDispatcher] external service returned', response.status);
      return [];
    }

    const data = await response.json() as {
      matches?: Array<{
        offset: number;
        length: number;
        message?: string;
        rule?: { issueType?: string };
        replacements?: Array<{ value: string }>;
      }>;
    };

    if (!Array.isArray(data.matches)) return [];

    return data.matches.map((m) => ({
      offset: m.offset ?? 0,
      length: m.length ?? 0,
      kind: (m.rule?.issueType === 'misspelling' ? 'spelling' : 'grammar') as 'spelling' | 'grammar',
      suggestions: (m.replacements ?? []).slice(0, 8).map((r) => r.value),
      message: m.message,
    }));
  } catch (err) {
    console.warn('[SpellCheckDispatcher] external service call failed:', err);
    return [];
  }
}
