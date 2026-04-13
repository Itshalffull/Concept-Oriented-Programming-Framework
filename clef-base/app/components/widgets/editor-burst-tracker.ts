/**
 * editor-burst-tracker.ts
 *
 * Keystroke burst coalescer for RecursiveBlockEditor.
 *
 * Tracks consecutive keystrokes on a focused block and coalesces them
 * into a single Patch entry pushed onto the UndoStack when the burst ends.
 *
 * Burst boundary conditions (any one ends the current burst):
 *   - Time-since-last-keystroke >= BURST_GAP_MS (800 ms)
 *   - Cursor jump > 1 character position (non-typing movement)
 *   - A non-typing edit interleaves (block-level structural edit, e.g. insert/delete block)
 *   - The block loses focus (blur)
 *
 * On burst end, the tracker computes a Patch from (oldText, newText), invokes
 * Patch/create through the provided kernel invoker, then pushes the result onto
 * UndoStack via UndoStack/push with reversalAction = "Patch/applyInverse".
 *
 * The owning component (RecursiveBlockEditor) calls:
 *   tracker.recordKeystroke(blockId, oldBody, newBody, cursorPos)
 *   tracker.endBurst()   — on blur / cursor jump / structural edit
 *
 * Section reference: Architecture doc §clef-base — PP-undo
 */

/** Kernel invoker shape expected from useKernelInvoke() */
export type KernelInvoker = (
  concept: string,
  action: string,
  input: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

const BURST_GAP_MS = 800;

interface BurstState {
  blockId: string;
  oldBody: string;
  latestBody: string;
  lastKeystrokeAt: number;
  lastCursorPos: number;
  timer: ReturnType<typeof setTimeout> | null;
}

export interface EditorBurstTracker {
  /**
   * Call on every input event on a block's contentEditable.
   *
   * @param blockId     The ContentNode id of the focused block.
   * @param oldBody     The body text BEFORE this keystroke (captured before input fires).
   * @param newBody     The body text AFTER this keystroke.
   * @param cursorPos   The caret offset after the keystroke (0-based character index).
   */
  recordKeystroke(
    blockId: string,
    oldBody: string,
    newBody: string,
    cursorPos: number,
  ): void;

  /**
   * Immediately end the current burst (if any) and push a Patch entry.
   * Call on blur, detected cursor jump > 1, or non-typing structural edit.
   */
  endBurst(): void;

  /**
   * Release all pending state without committing. Call on unmount.
   */
  dispose(): void;
}

/**
 * Factory — call once per editor instance, passing the kernel invoker and
 * the UndoStack id for this editor session.
 *
 * @param invoke       Kernel invoker from useKernelInvoke().
 * @param undoStackId  The UndoStack identifier for the current editing session.
 *                     Typically derived from the rootNodeId of the document.
 */
export function createEditorBurstTracker(
  invoke: KernelInvoker,
  undoStackId: string,
): EditorBurstTracker {
  let burst: BurstState | null = null;

  // ------------------------------------------------------------------
  // Internal helpers
  // ------------------------------------------------------------------

  function clearTimer() {
    if (burst?.timer !== null && burst?.timer !== undefined) {
      clearTimeout(burst.timer);
      burst.timer = null;
    }
  }

  /**
   * Commit the accumulated burst as a Patch + UndoStack entry.
   * Async fire-and-forget — errors are console.warn'd, never thrown.
   */
  async function commitBurst(state: BurstState): Promise<void> {
    if (state.oldBody === state.latestBody) {
      // Nothing actually changed — skip.
      return;
    }

    try {
      // Build a minimal edit-script JSON for Patch/create.
      // The effect encodes oldText and newText so Patch/applyInverse can reconstruct.
      const effect = JSON.stringify([
        { type: 'delete', line: 0, content: state.oldBody },
        { type: 'insert', line: 0, content: state.latestBody },
      ]);

      const createResult = await invoke('Patch', 'create', {
        base: `block:${state.blockId}:before`,
        target: `block:${state.blockId}:after`,
        effect,
      });

      if (createResult.variant !== 'ok') {
        console.warn('[editor-burst-tracker] Patch/create returned non-ok:', createResult.variant);
        return;
      }

      const patchId = createResult.patchId as string;

      // Push onto UndoStack. The reversalAction points to Patch/applyInverse
      // so UndoStack/undo will re-dispatch the inverse as a single action.
      const pushResult = await invoke('UndoStack', 'push', {
        stack: undoStackId,
        action: 'Patch/apply',
        params: JSON.stringify({ patchId, content: state.latestBody }),
        result: JSON.stringify({ blockId: state.blockId, body: state.latestBody }),
        trace: `burst:${state.blockId}:${state.lastKeystrokeAt}`,
        reversalAction: 'Patch/applyInverse',
      });

      if (pushResult.variant !== 'ok' && pushResult.variant !== 'full') {
        console.warn('[editor-burst-tracker] UndoStack/push returned non-ok:', pushResult.variant);
      }
    } catch (err) {
      console.error('[editor-burst-tracker] commitBurst failed:', err);
    }
  }

  function scheduleAutoEnd() {
    clearTimer();
    burst!.timer = setTimeout(() => {
      endBurst();
    }, BURST_GAP_MS);
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  function recordKeystroke(
    blockId: string,
    oldBody: string,
    newBody: string,
    cursorPos: number,
  ): void {
    const now = Date.now();

    if (!burst || burst.blockId !== blockId) {
      // First keystroke in a burst, or focus moved to a different block.
      if (burst) {
        // End the previous block's burst synchronously before starting the new one.
        const prev = burst;
        clearTimer();
        burst = null;
        commitBurst(prev);
      }
      burst = {
        blockId,
        oldBody,
        latestBody: newBody,
        lastKeystrokeAt: now,
        lastCursorPos: cursorPos,
        timer: null,
      };
      scheduleAutoEnd();
      return;
    }

    // Same block — check cursor jump (> 1 char jump = navigation, not typing).
    const cursorDelta = Math.abs(cursorPos - burst.lastCursorPos);
    if (cursorDelta > 1) {
      // Cursor jumped: end the current burst, start a fresh one.
      const prev = burst;
      clearTimer();
      burst = {
        blockId,
        oldBody: prev.latestBody,
        latestBody: newBody,
        lastKeystrokeAt: now,
        lastCursorPos: cursorPos,
        timer: null,
      };
      commitBurst(prev);
      scheduleAutoEnd();
      return;
    }

    // Continuing the same burst.
    burst.latestBody = newBody;
    burst.lastKeystrokeAt = now;
    burst.lastCursorPos = cursorPos;
    scheduleAutoEnd();
  }

  function endBurst(): void {
    if (!burst) return;
    const state = burst;
    clearTimer();
    burst = null;
    commitBurst(state);
  }

  function dispose(): void {
    clearTimer();
    burst = null;
  }

  return { recordKeystroke, endBurst, dispose };
}
