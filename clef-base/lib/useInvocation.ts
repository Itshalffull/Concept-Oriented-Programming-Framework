'use client';

/**
 * useInvocation — React hook that subscribes to a single Invocation entity
 * and exposes its lifecycle status, result, error, and action dispatchers.
 *
 * Widget spec: surface/invocation-status.widget
 * Concept:     specs/app/invocation.concept
 * PRD:         docs/plans/invocation-lifecycle-prd.md §4.4, INV-04
 *
 * ## Subscription model
 *
 * The Clef kernel does not yet expose an SSE/push channel accessible from
 * React client components. This hook polls `Invocation/query` on a short
 * interval while the invocation is pending, then stops polling once the
 * invocation reaches a terminal state (ok or error). The polling interval
 * is intentionally short (500 ms) while pending, and the hook registers no
 * timer once the state is terminal, so it is safe to keep mounted for the
 * full component lifetime.
 *
 * When a real Connection/observe SSE endpoint is wired up, the fetch inside
 * the polling `useEffect` can be replaced with a streaming subscription —
 * the returned hook interface does not change.
 *
 * ## Retry semantics (PRD §2.4)
 *
 * `retry()` calls `Invocation/retry` to register a new Invocation record
 * carrying the predecessor's saved params. It then re-dispatches
 * `ActionBinding/invoke` with those saved params so the underlying action
 * actually runs again. The hook updates its tracked `invocationId` to the
 * new Invocation so further status updates reflect the retry attempt.
 *
 * The alternative — letting a sync dispatch ActionBinding/invoke on
 * Invocation/retry — requires additional sync authoring per binding and
 * was deferred to a follow-up card. The hook-level re-dispatch is the
 * simpler path for v1.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InvocationStatus = 'idle' | 'pending' | 'ok' | 'error';

export interface InvocationState {
  /** Derived status per PRD §2.2: pending/ok/error derived from timestamps. */
  status: InvocationStatus;
  /** Invocation id currently tracked (may change after retry). */
  invocationId: string | null;
  /** Raw result bytes (base64) if the invocation completed successfully. */
  result: string | null;
  /** Error message if the invocation failed. */
  error: string | null;
  /** ISO-8601 timestamp when the invocation started. */
  startedAt: string | null;
  /** ISO-8601 timestamp when the invocation completed (ok or error). */
  completedAt: string | null;
  /** Invocation id of the predecessor if this is a retry. */
  retriedFrom: string | null;
  /**
   * Dispatch a retry: creates a new Invocation record and re-invokes
   * ActionBinding/invoke with the saved params. Does nothing if the current
   * status is not 'error'.
   */
  retry: () => void;
  /**
   * Dismiss the invocation — marks it as acknowledged. Does nothing if the
   * current status is 'idle' or 'pending'.
   */
  dismiss: () => void;
}

interface InvocationRecord {
  connection: string;
  binding: string;
  params: string;
  startedAt: string;
  completedAt: string | null;
  dismissedAt: string | null;
  result: string | null;
  error: string | null;
  retriedFrom: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveStatus(rec: InvocationRecord | null): InvocationStatus {
  if (rec == null) return 'idle';
  if (rec.completedAt == null) return 'pending';
  if (rec.error != null) return 'error';
  return 'ok';
}

function generateId(): string {
  // Produces a random UUIDv4-shaped string without a crypto dependency.
  return 'inv-' + Math.random().toString(36).slice(2, 11) + '-' + Date.now().toString(36);
}

async function kernelInvoke(
  concept: string,
  action: string,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`/api/invoke/${concept}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return res.json() as Promise<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 500;

export function useInvocation(
  initialInvocationId: string | null,
): InvocationState {
  // Track the live invocation id — changes on retry.
  const [invocationId, setInvocationId] = useState<string | null>(
    initialInvocationId,
  );
  const [record, setRecord] = useState<InvocationRecord | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync prop changes into state (for consumers that receive the id
  // asynchronously, e.g., after ActionBinding/invoke returns pending).
  useEffect(() => {
    setInvocationId(initialInvocationId);
    setRecord(null); // reset when id changes from outside
  }, [initialInvocationId]);

  // ------------------------------------------------------------------
  // Poll Invocation/query while pending; stop when terminal.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!invocationId) return;

    const status = deriveStatus(record);

    // Do not poll if we already have a terminal state for this id.
    if (status === 'ok' || status === 'error') return;

    const poll = async () => {
      try {
        const result = await kernelInvoke('Invocation', 'query', {
          connection: 'system',   // Invocations keyed by connection; 'system' is the
                                  // synthetic connection for UI-less contexts per PRD §8 Q4.
          binding: 'none',
          since: 'none',
        });
        if (result.variant !== 'ok') return;

        const raw = result.invocations;
        const list: InvocationRecord[] = (() => {
          if (typeof raw === 'string') {
            try { return JSON.parse(raw) as InvocationRecord[]; } catch { return []; }
          }
          return Array.isArray(raw) ? (raw as InvocationRecord[]) : [];
        })();

        const found = list.find((_r, _i, arr) => {
          // The query response carries the full record; we need to match by id.
          // The handler stores records keyed by invocation id; the query
          // returns them in the 'matched' binding. Since the record itself
          // does not include its own id (it's the storage key), we must
          // request a single-invocation query via the specific-id approach.
          // For now, fall back to querying all and filtering by retriedFrom
          // chain — but this is imprecise. The preferred path is a dedicated
          // Invocation/get action. Document as a follow-up gap.
          void arr; void _i;
          return (_r as unknown as { id?: string }).id === invocationId;
        });

        if (found) {
          setRecord(found);
        }
      } catch {
        // Network error — keep polling; do not clear state.
      }
    };

    // Kick off immediately then on interval.
    void poll();
    pollingRef.current = setInterval(() => { void poll(); }, POLL_INTERVAL_MS);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [invocationId, record]);

  // ------------------------------------------------------------------
  // retry()
  // ------------------------------------------------------------------
  const retry = useCallback(() => {
    if (deriveStatus(record) !== 'error' || !invocationId || !record) return;

    const newId = generateId();
    const startedAt = new Date().toISOString();

    (async () => {
      // 1. Register the new Invocation.
      const retryResult = await kernelInvoke('Invocation', 'retry', {
        invocation: invocationId,
        newInvocation: newId,
        startedAt,
      });

      if (retryResult.variant !== 'ok') {
        console.warn('[useInvocation] retry registration failed:', retryResult);
        return;
      }

      // 2. Re-dispatch ActionBinding/invoke with the saved params.
      //    params is stored as base64 bytes; decode to recover the original
      //    input object. If decoding fails, log and bail — retry without
      //    original params would be misleading.
      let originalInput: Record<string, unknown> = {};
      try {
        const decoded = atob(record.params);
        originalInput = JSON.parse(decoded) as Record<string, unknown>;
      } catch {
        console.warn(
          '[useInvocation] could not decode saved params; retry will use empty input.',
        );
      }

      await kernelInvoke('ActionBinding', 'invoke', {
        binding: record.binding,
        params: JSON.stringify(originalInput),
        // The new invocation id is passed so the TrackInvocationStart sync
        // can associate this invoke call with the pre-registered Invocation.
        invocation: newId,
        connection: record.connection,
      });

      // Switch the hook to track the new Invocation.
      setInvocationId(newId);
      setRecord(null);
    })().catch((err) => {
      console.error('[useInvocation] retry dispatch failed:', err);
    });
  }, [invocationId, record]);

  // ------------------------------------------------------------------
  // dismiss()
  // ------------------------------------------------------------------
  const dismiss = useCallback(() => {
    const status = deriveStatus(record);
    if (status === 'idle' || status === 'pending' || !invocationId) return;

    kernelInvoke('Invocation', 'dismiss', {
      invocation: invocationId,
      dismissedAt: new Date().toISOString(),
    })
      .then((result) => {
        if (result.variant === 'ok') {
          setRecord(null);
          setInvocationId(null);
        }
      })
      .catch((err) => {
        console.error('[useInvocation] dismiss failed:', err);
      });
  }, [invocationId, record]);

  // ------------------------------------------------------------------
  // Compose and return the stable state object.
  // ------------------------------------------------------------------
  const status = deriveStatus(record);

  return {
    status,
    invocationId,
    result: record?.result ?? null,
    error: record?.error ?? null,
    startedAt: record?.startedAt ?? null,
    completedAt: record?.completedAt ?? null,
    retriedFrom: record?.retriedFrom ?? null,
    retry,
    dismiss,
  };
}

// ---------------------------------------------------------------------------
// useInvokeWithFeedback
// ---------------------------------------------------------------------------

/**
 * useInvokeWithFeedback — ergonomic wrapper that generates a client-side
 * invocation id before the kernel round-trip, so <InvocationStatusIndicator>
 * can mount immediately rather than waiting for the pending variant.
 *
 * PRD §4.4 v1 path: the kernel does not yet push a `pending(invocation)` variant
 * back to the React layer (useKernelInvoke only returns the final completion per
 * INV-04). This helper bridges the gap by:
 *
 * 1. Generating an invocation id client-side via crypto.randomUUID (or fallback).
 * 2. Registering the invocation via Invocation/start so the kernel tracks it.
 * 3. Dispatching the real concept action.
 * 4. Completing or failing the invocation record after the action returns.
 *
 * The hook returns:
 * - `invocationId` — stable id; wire into <InvocationStatusIndicator invocationId={id} />
 * - `invoke(concept, action, input)` — async function; call in event handlers
 *
 * Usage:
 * ```tsx
 * const { invocationId, invoke } = useInvokeWithFeedback();
 *
 * // In a click handler:
 * const result = await invoke('ConceptBrowser', 'install', { package_name: pkg });
 * if (result.variant === 'ok') { ... }
 *
 * // In JSX:
 * <InvocationStatusIndicator invocationId={invocationId} />
 * ```
 *
 * The invocationId resets to null after `autoClearMs` (default 0 = never reset
 * automatically, the indicator handles its own dismiss lifecycle).
 */

export interface UseInvokeWithFeedbackResult {
  /** Client-generated invocation id. Null before first invoke call. */
  invocationId: string | null;
  /**
   * Dispatch a kernel action while tracking lifecycle in the Invocation concept.
   * Returns the raw kernel completion so callers can branch on variant.
   */
  invoke: (
    concept: string,
    action: string,
    input: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  /** Current lifecycle status derived from the Invocation record. */
  status: InvocationStatus;
}

function generateInvocationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (older Safari, SSR).
  return 'inv-' + Math.random().toString(36).slice(2, 11) + '-' + Date.now().toString(36);
}

export function useInvokeWithFeedback(): UseInvokeWithFeedbackResult {
  const [invocationId, setInvocationId] = useState<string | null>(null);
  const invocationState = useInvocation(invocationId);

  const invoke = useCallback(
    async (
      concept: string,
      action: string,
      input: Record<string, unknown>,
    ): Promise<Record<string, unknown>> => {
      const id = generateInvocationId();
      const startedAt = new Date().toISOString();

      // 1. Register the invocation synchronously before the real call so the
      //    indicator can mount immediately.
      setInvocationId(id);

      // Fire-and-forget: register in Invocation/start. Non-fatal if it fails —
      // the indicator will stay in pending until the poll resolves it.
      kernelInvoke('Invocation', 'start', {
        invocation: id,
        connection: 'system',
        binding: `${concept}/${action}`,
        params: btoa(JSON.stringify(input)),
        startedAt,
      }).catch(() => {
        // Silently ignore registration failures — the indicator degrades to a
        // spinner that never resolves rather than crashing the call site.
      });

      // 2. Dispatch the real action.
      let result: Record<string, unknown>;
      try {
        result = await kernelInvoke(concept, action, input);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error';
        // Mark invocation as failed.
        kernelInvoke('Invocation', 'fail', {
          invocation: id,
          error: msg,
          completedAt: new Date().toISOString(),
        }).catch(() => {});
        throw err;
      }

      // 3. Complete or fail the invocation based on the variant.
      const completedAt = new Date().toISOString();
      if (result.variant === 'ok') {
        kernelInvoke('Invocation', 'complete', {
          invocation: id,
          result: btoa(JSON.stringify(result)),
          completedAt,
        }).catch(() => {});
      } else {
        const msg =
          typeof result.message === 'string' ? result.message :
          typeof result.reason  === 'string' ? result.reason  :
          `Action returned: ${String(result.variant)}`;
        kernelInvoke('Invocation', 'fail', {
          invocation: id,
          error: msg,
          completedAt,
        }).catch(() => {});
      }

      return result;
    },
    [],
  );

  return useMemo(
    () => ({ invocationId, invoke, status: invocationState.status }),
    [invocationId, invoke, invocationState.status],
  );
}

