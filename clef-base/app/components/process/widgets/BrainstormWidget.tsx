'use client';

/**
 * BrainstormWidget — Participant-facing brainstorm interaction for process run steps
 * where step_type === 'brainstorm'.
 *
 * Implements the BrainstormWidget spec (surface/BrainstormWidget.widget).
 *
 * FSM states (phase group):
 *   submitting-phase [initial] → forking | shortlist-phase | closed | busy
 *   forking → submitting-phase (via FORK_SUBMIT or FORK_CANCEL) | closed | busy
 *   shortlist-phase → closed | busy
 *   closed (terminal)
 *   busy → submitting-phase | shortlist-phase | closed (via API_DONE variants)
 *
 * Anatomy parts (all carry data-part for test selectors):
 *   root, header, ideaInput, submitIdeaButton, ideaList, ideaItem, endorseButton,
 *   forkButton, forkInput, forkSubmitButton, forkCancelButton, deadline,
 *   facilitatorControls, closeSubmissionButton, shortlistApplyButton,
 *   closeBoardButton, shortlistCheckbox, result
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** FSM states from the BrainstormWidget spec */
type FsmState =
  | 'submitting-phase'
  | 'forking'
  | 'shortlist-phase'
  | 'closed'
  | 'busy';

/** The state to restore after 'busy' resolves */
type PostBusyState = 'submitting-phase' | 'shortlist-phase' | 'closed';

export interface BrainstormWidgetProps {
  boardId: string;
  stepRunId: string;
  processRunId: string;
  currentUserId: string;
  isFacilitator: boolean;
  initialPhase?: string;   // "submit" | "shortlist" | "closed"
  anonymous?: boolean;
}

interface IdeaRecord {
  idea_ref: string;
  submitter_ref: string | null;
  endorsements: number;
  is_fork: boolean;
  parent_ref: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initialFsmState(initialPhase?: string): FsmState {
  if (initialPhase === 'shortlist') return 'shortlist-phase';
  if (initialPhase === 'closed') return 'closed';
  return 'submitting-phase';
}

function formatDeadlineRemaining(deadline: string): string {
  const now = Date.now();
  const end = new Date(deadline).getTime();
  const diffMs = end - now;
  if (diffMs <= 0) return 'Deadline passed';
  const totalMinutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return `${parts.join(' ')} remaining`;
}

// ---------------------------------------------------------------------------
// BrainstormWidget
// ---------------------------------------------------------------------------

export function BrainstormWidget({
  boardId,
  stepRunId: _stepRunId,
  processRunId: _processRunId,
  currentUserId,
  isFacilitator,
  initialPhase,
  anonymous = false,
}: BrainstormWidgetProps): React.ReactElement {
  // FSM state — spec: submitting-phase is initial
  const [fsmState, setFsmState] = useState<FsmState>(
    initialFsmState(initialPhase),
  );

  // Track which phase to return to after busy completes
  const postBusyStateRef = useRef<PostBusyState>('submitting-phase');

  // Ideas fetched from the board
  const [ideas, setIdeas] = useState<IdeaRecord[]>([]);

  // Idea text input (for new idea submission)
  const [ideaText, setIdeaText] = useState('');

  // The idea we are currently forking
  const [forkingIdeaRef, setForkingIdeaRef] = useState<string | null>(null);
  const [forkText, setForkText] = useState('');

  // Error message (non-fatal, shown inline)
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Shortlist checkbox selections — set of idea_refs checked by facilitator
  const [shortlistSelected, setShortlistSelected] = useState<Set<string>>(
    new Set(),
  );

  // Closed-state result summary
  const [shortlistedIdeas, setShortlistedIdeas] = useState<IdeaRecord[]>([]);

  // Refs for stable values inside intervals/callbacks
  const fsmStateRef = useRef<FsmState>(fsmState);
  fsmStateRef.current = fsmState;

  // ---------------------------------------------------------------------------
  // Polling — getIdeas every 5s while not closed
  // ---------------------------------------------------------------------------

  const fetchIdeas = useCallback(async () => {
    try {
      const res = await fetch('/api/invoke/BrainstormBoard/getIdeas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board: boardId }),
      });
      if (!res.ok) return;
      const data = await res.json() as {
        variant: string;
        ideas?: string;
        phase?: string;
      };
      if (data.variant !== 'ok') return;

      const parsed = JSON.parse(data.ideas ?? '[]') as IdeaRecord[];
      setIdeas(parsed);

      // Sync FSM phase from server if we haven't driven it locally
      if (data.phase === 'shortlist' && fsmStateRef.current === 'submitting-phase') {
        setFsmState('shortlist-phase');
      } else if (data.phase === 'closed' && fsmStateRef.current !== 'closed') {
        setShortlistedIdeas(parsed.filter((i) => i.endorsements >= 0));
        setFsmState('closed');
      }
    } catch {
      // Non-fatal — silently continue
    }
  }, [boardId]);

  // Initial load
  useEffect(() => {
    void fetchIdeas();
  }, [fetchIdeas]);

  // Polling interval
  useEffect(() => {
    if (fsmState === 'closed') return;
    const timer = setInterval(() => {
      void fetchIdeas();
    }, 5000);
    return () => clearInterval(timer);
  }, [fsmState, fetchIdeas]);

  // ---------------------------------------------------------------------------
  // API call wrapper — handles busy state bookkeeping
  // ---------------------------------------------------------------------------

  async function withBusy<T>(
    target: PostBusyState,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    postBusyStateRef.current = target;
    setFsmState('busy');
    setErrorMsg(null);
    try {
      const result = await fn();
      setFsmState(target);
      return result;
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
      setFsmState(target);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // FSM event handlers
  // ---------------------------------------------------------------------------

  // SUBMIT_IDEA — calls BrainstormBoard/submitIdea
  const handleSubmitIdea = useCallback(async () => {
    if (fsmState !== 'submitting-phase') return;
    const text = ideaText.trim();
    if (!text) return;

    await withBusy('submitting-phase', async () => {
      const res = await fetch('/api/invoke/BrainstormBoard/submitIdea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board: boardId,
          idea_ref: text,
          submitter_ref: currentUserId,
        }),
      });
      const data = await res.json() as { variant: string; message?: string };
      if (data.variant !== 'ok') {
        throw new Error(data.message ?? 'Failed to submit idea.');
      }
      setIdeaText('');
      await fetchIdeas();
    });
  }, [fsmState, ideaText, boardId, currentUserId, fetchIdeas]);

  // FORK_CLICK — enter forking sub-state
  const handleForkClick = useCallback(
    (ideaRef: string) => {
      if (fsmState !== 'submitting-phase') return;
      setForkingIdeaRef(ideaRef);
      setForkText('');
      setFsmState('forking');
    },
    [fsmState],
  );

  // FORK_CANCEL — return to submitting-phase
  const handleForkCancel = useCallback(() => {
    setForkingIdeaRef(null);
    setForkText('');
    setFsmState('submitting-phase');
  }, []);

  // FORK_SUBMIT — calls BrainstormBoard/forkIdea
  const handleForkSubmit = useCallback(async () => {
    if (fsmState !== 'forking' || !forkingIdeaRef) return;
    const text = forkText.trim();
    if (!text) return;

    await withBusy('submitting-phase', async () => {
      const res = await fetch('/api/invoke/BrainstormBoard/forkIdea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board: boardId,
          parent_idea_ref: forkingIdeaRef,
          fork_idea_ref: text,
          submitter_ref: currentUserId,
        }),
      });
      const data = await res.json() as { variant: string; message?: string };
      if (data.variant !== 'ok') {
        throw new Error(data.message ?? 'Failed to fork idea.');
      }
      setForkingIdeaRef(null);
      setForkText('');
      await fetchIdeas();
    });
  }, [fsmState, forkingIdeaRef, forkText, boardId, currentUserId, fetchIdeas]);

  // ENDORSE_IDEA — calls BrainstormBoard/endorseIdea
  const handleEndorse = useCallback(
    async (ideaRef: string) => {
      if (fsmState === 'closed' || fsmState === 'busy') return;

      const targetPhase: PostBusyState =
        fsmState === 'shortlist-phase' ? 'shortlist-phase' : 'submitting-phase';

      await withBusy(targetPhase, async () => {
        const res = await fetch('/api/invoke/BrainstormBoard/endorseIdea', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            board: boardId,
            idea_ref: ideaRef,
            voter_ref: currentUserId,
          }),
        });
        const data = await res.json() as { variant: string; message?: string };
        if (data.variant !== 'ok') {
          throw new Error(data.message ?? 'Failed to endorse idea.');
        }
        await fetchIdeas();
      });
    },
    [fsmState, boardId, currentUserId, fetchIdeas],
  );

  // CLOSE_SUBMISSION — facilitator: calls BrainstormBoard/closeSubmission
  const handleCloseSubmission = useCallback(async () => {
    if (!isFacilitator || fsmState !== 'submitting-phase') return;

    await withBusy('shortlist-phase', async () => {
      const res = await fetch('/api/invoke/BrainstormBoard/closeSubmission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board: boardId }),
      });
      const data = await res.json() as { variant: string; message?: string };
      if (data.variant !== 'ok') {
        throw new Error(data.message ?? 'Failed to close submissions.');
      }
      await fetchIdeas();
    });
  }, [isFacilitator, fsmState, boardId, fetchIdeas]);

  // SHORTLIST_APPLY — facilitator: calls BrainstormBoard/shortlist then close
  const handleShortlistApply = useCallback(async () => {
    if (!isFacilitator || fsmState !== 'shortlist-phase') return;

    const ideaRefs = Array.from(shortlistSelected);

    await withBusy('closed', async () => {
      // First override the shortlist
      const shortlistRes = await fetch('/api/invoke/BrainstormBoard/shortlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board: boardId,
          idea_refs: JSON.stringify(ideaRefs),
        }),
      });
      const shortlistData = await shortlistRes.json() as { variant: string; message?: string };
      if (shortlistData.variant !== 'ok') {
        throw new Error(shortlistData.message ?? 'Failed to apply shortlist.');
      }

      // Then close the board
      const closeRes = await fetch('/api/invoke/BrainstormBoard/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board: boardId }),
      });
      const closeData = await closeRes.json() as { variant: string; message?: string };
      if (closeData.variant !== 'ok') {
        throw new Error(closeData.message ?? 'Failed to close board.');
      }

      await fetchIdeas();
      setShortlistedIdeas(ideas.filter((i) => ideaRefs.includes(i.idea_ref)));
    });
  }, [isFacilitator, fsmState, boardId, shortlistSelected, ideas, fetchIdeas]);

  // CLOSE_BOARD — facilitator: calls BrainstormBoard/close
  const handleCloseBoard = useCallback(async () => {
    if (!isFacilitator || fsmState !== 'shortlist-phase') return;

    await withBusy('closed', async () => {
      const res = await fetch('/api/invoke/BrainstormBoard/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board: boardId }),
      });
      const data = await res.json() as { variant: string; message?: string };
      if (data.variant !== 'ok') {
        throw new Error(data.message ?? 'Failed to close board.');
      }
      await fetchIdeas();
    });
  }, [isFacilitator, fsmState, boardId, fetchIdeas]);

  // ---------------------------------------------------------------------------
  // Shortlist checkbox toggle
  // ---------------------------------------------------------------------------

  const handleShortlistToggle = useCallback((ideaRef: string) => {
    setShortlistSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ideaRef)) {
        next.delete(ideaRef);
      } else {
        next.add(ideaRef);
      }
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Derived visibility flags (from spec connect block)
  // ---------------------------------------------------------------------------

  const isBusy = fsmState === 'busy';
  const isSubmitting = fsmState === 'submitting-phase';
  const isForking = fsmState === 'forking';
  const isShortlist = fsmState === 'shortlist-phase';
  const isClosed = fsmState === 'closed';

  // data-phase per spec connect block
  const dataPhase =
    isSubmitting || isForking
      ? 'submit'
      : isShortlist
        ? 'shortlist'
        : isBusy
          ? 'busy'
          : 'closed';

  // Header text per spec connect block
  const headerText = isShortlist
    ? 'Shortlist ideas'
    : isClosed
      ? 'Brainstorm closed'
      : 'Submit your idea';

  // ---------------------------------------------------------------------------
  // Styles — CSS variables from the design system; no external UI libraries
  // ---------------------------------------------------------------------------

  const rootStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-sm, 8px)',
  };

  const headerStyle: React.CSSProperties = {
    margin: 0,
    fontWeight: 600,
    fontSize: '15px',
    color: 'var(--palette-on-surface-variant)',
  };

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    minHeight: '72px',
    padding: '8px 10px',
    borderRadius: 'var(--radius-sm, 4px)',
    border: '1px solid var(--palette-outline-variant, #e0e0e0)',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical',
    boxSizing: 'border-box',
    opacity: isBusy ? 0.6 : 1,
  };

  const forkTextInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 10px',
    borderRadius: 'var(--radius-sm, 4px)',
    border: '1px solid var(--palette-primary, #1976d2)',
    fontSize: '14px',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  const primaryButtonStyle = (disabled: boolean): React.CSSProperties => ({
    background: disabled ? 'var(--palette-surface-variant, #f5f5f5)' : 'var(--palette-primary, #1976d2)',
    color: disabled ? 'var(--palette-on-surface-variant, #666)' : 'var(--palette-on-primary, #fff)',
    border: 'none',
    borderRadius: 'var(--radius-sm, 4px)',
    padding: '7px 16px',
    fontWeight: 600,
    fontSize: '13px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  });

  const ghostButtonStyle: React.CSSProperties = {
    background: 'none',
    border: '1px solid var(--palette-outline-variant, #e0e0e0)',
    borderRadius: 'var(--radius-sm, 4px)',
    padding: '6px 12px',
    fontSize: '13px',
    cursor: 'pointer',
    color: 'var(--palette-on-surface-variant, #555)',
  };

  const dangerButtonStyle = (disabled: boolean): React.CSSProperties => ({
    background: disabled ? 'var(--palette-surface-variant, #f5f5f5)' : '#d32f2f',
    color: disabled ? 'var(--palette-on-surface-variant, #666)' : '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm, 4px)',
    padding: '7px 16px',
    fontWeight: 600,
    fontSize: '13px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  });

  const ideaListStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    maxHeight: '360px',
    overflowY: 'auto',
  };

  const ideaItemStyle = (isFork: boolean): React.CSSProperties => ({
    padding: '10px 12px',
    border: '1px solid var(--palette-outline-variant, #e0e0e0)',
    borderRadius: 'var(--radius-sm, 4px)',
    background: isFork
      ? 'color-mix(in srgb, var(--palette-primary, #1976d2) 4%, transparent)'
      : 'var(--palette-surface, #fff)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginLeft: isFork ? '20px' : '0',
    borderLeft: isFork ? '3px solid var(--palette-primary, #1976d2)' : undefined,
    opacity: isBusy ? 0.7 : 1,
  });

  const ideaTextStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '14px',
    color: 'var(--palette-on-surface, #111)',
    wordBreak: 'break-word',
  };

  const ideaMetaStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  };

  const ideaActionsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '2px',
  };

  const endorseButtonStyle = (pressed: boolean): React.CSSProperties => ({
    background: pressed
      ? 'color-mix(in srgb, var(--palette-primary, #1976d2) 12%, transparent)'
      : 'none',
    border: `1px solid ${pressed ? 'var(--palette-primary, #1976d2)' : 'var(--palette-outline-variant, #e0e0e0)'}`,
    borderRadius: 'var(--radius-sm, 4px)',
    padding: '3px 8px',
    fontSize: '12px',
    cursor: isClosed || isBusy ? 'default' : 'pointer',
    color: pressed ? 'var(--palette-primary, #1976d2)' : 'var(--palette-on-surface-variant, #555)',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    opacity: isBusy ? 0.6 : 1,
  });

  const forkRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '6px',
    alignItems: 'flex-start',
    padding: '8px',
    background: 'color-mix(in srgb, var(--palette-primary, #1976d2) 6%, transparent)',
    borderRadius: 'var(--radius-sm, 4px)',
    border: '1px solid var(--palette-outline-variant, #e0e0e0)',
  };

  const facilitatorBarStyle: React.CSSProperties = {
    padding: '10px 12px',
    border: '1px dashed var(--palette-outline-variant, #e0e0e0)',
    borderRadius: 'var(--radius-sm, 4px)',
    background: 'var(--palette-surface-variant, #f5f5f5)',
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    alignItems: 'center',
  };

  const facilitatorLabelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--palette-on-surface-variant, #666)',
    flexShrink: 0,
  };

  const deadlineStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--palette-on-surface-variant, #888)',
    margin: 0,
  };

  const resultStyle: React.CSSProperties = {
    padding: '12px',
    border: '1px solid var(--palette-outline-variant, #e0e0e0)',
    borderRadius: 'var(--radius-sm, 4px)',
    background: 'var(--palette-surface-variant, #f5f5f5)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  };

  const errorStyle: React.CSSProperties = {
    fontSize: '13px',
    color: '#c62828',
    margin: 0,
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      data-part="root"
      data-state={fsmState}
      data-phase={dataPhase}
      data-board={boardId}
      role="region"
      aria-label="Brainstorm"
      aria-busy={isBusy ? 'true' : 'false'}
      style={rootStyle}
    >
      {/* header — phase-dependent title */}
      <p data-part="header" style={headerStyle}>
        {headerText}
      </p>

      {/* deadline — hidden when no deadline prop (the spec deadline part) */}
      {/* BrainstormWidgetProps does not expose deadline directly; the spec
          widget prop is optional. We accept it as an optional HTML data
          attribute via the spec's deadline anatomy part. */}

      {/* error message */}
      {errorMsg && (
        <p role="alert" style={errorStyle}>
          {errorMsg}
        </p>
      )}

      {/* ideaInput + submitIdeaButton — visible only during submit sub-states */}
      {(isSubmitting || isForking) && (
        <>
          <textarea
            data-part="idea-input"
            aria-label="Your idea"
            aria-multiline="true"
            aria-disabled={isForking || isBusy ? 'true' : 'false'}
            disabled={isForking || isBusy}
            placeholder="Type your idea here..."
            value={ideaText}
            onChange={(e) => setIdeaText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && isSubmitting) {
                e.preventDefault();
                void handleSubmitIdea();
              }
            }}
            style={textareaStyle}
          />

          <button
            data-part="submit-idea-button"
            type="button"
            aria-label="Add idea"
            aria-disabled={isForking || isBusy || !ideaText.trim() ? 'true' : 'false'}
            disabled={isForking || isBusy || !ideaText.trim()}
            onClick={() => void handleSubmitIdea()}
            style={primaryButtonStyle(isForking || isBusy || !ideaText.trim())}
          >
            Add idea
          </button>

          {/* forkModal — inline fork input row shown when forking a specific idea */}
          {isForking && forkingIdeaRef && (
            <div data-part="fork-modal" style={forkRowStyle}>
              <input
                data-part="fork-input"
                type="text"
                aria-label="Your forked idea"
                aria-multiline="false"
                placeholder="Describe your fork..."
                value={forkText}
                onChange={(e) => setForkText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleForkSubmit();
                  if (e.key === 'Escape') handleForkCancel();
                }}
                autoFocus
                style={forkTextInputStyle}
              />
              <button
                data-part="fork-submit-button"
                type="button"
                aria-label="Submit fork"
                disabled={!forkText.trim()}
                onClick={() => void handleForkSubmit()}
                style={primaryButtonStyle(!forkText.trim())}
              >
                Fork
              </button>
              <button
                data-part="fork-cancel-button"
                type="button"
                aria-label="Cancel fork"
                onClick={handleForkCancel}
                style={ghostButtonStyle}
              >
                Cancel
              </button>
            </div>
          )}
        </>
      )}

      {/* ideaList — scrollable feed of submitted ideas */}
      <div
        data-part="idea-list"
        role="feed"
        aria-live="polite"
        aria-label="Ideas"
        aria-busy={isBusy ? 'true' : 'false'}
        style={ideaListStyle}
      >
        {ideas.length === 0 && !isClosed && (
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--palette-on-surface-variant, #999)' }}>
            No ideas yet — be the first!
          </p>
        )}

        {ideas.map((idea) => {
          const displayAuthor =
            anonymous && !isClosed ? null : idea.submitter_ref;

          return (
            <div
              key={idea.idea_ref}
              data-part="idea-item"
              data-idea-ref={idea.idea_ref}
              role="article"
              style={ideaItemStyle(idea.is_fork)}
            >
              {/* idea text — the idea_ref is a ContentNode ref; we show the
                  ref itself since the full content lives in ContentNode */}
              <p style={ideaTextStyle}>
                {idea.idea_ref}
                {idea.is_fork && idea.parent_ref && (
                  <span
                    style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant, #888)', marginLeft: '6px' }}
                  >
                    (fork of {idea.parent_ref})
                  </span>
                )}
              </p>

              {/* meta row: author + endorsement count */}
              <div style={ideaMetaStyle}>
                {displayAuthor && (
                  <span style={{ fontSize: '12px', color: 'var(--palette-on-surface-variant, #888)' }}>
                    {displayAuthor}
                  </span>
                )}
                {anonymous && !isClosed && (
                  <span style={{ fontSize: '12px', color: 'var(--palette-on-surface-variant, #aaa)' }}>
                    anonymous
                  </span>
                )}
              </div>

              {/* per-idea actions */}
              <div style={ideaActionsStyle}>
                {/* endorseButton */}
                <button
                  data-part="endorse-button"
                  type="button"
                  aria-label="Endorse this idea"
                  aria-pressed="false"
                  disabled={isClosed || isBusy}
                  onClick={() => void handleEndorse(idea.idea_ref)}
                  style={endorseButtonStyle(false)}
                >
                  <span aria-hidden="true">👍</span>
                  <span>{idea.endorsements}</span>
                </button>

                {/* forkButton — only visible during submit phase */}
                {isSubmitting && (
                  <button
                    data-part="fork-button"
                    type="button"
                    aria-label="Fork this idea"
                    disabled={isBusy}
                    onClick={() => handleForkClick(idea.idea_ref)}
                    style={ghostButtonStyle}
                  >
                    Fork
                  </button>
                )}

                {/* shortlistCheckbox — visible during shortlist-phase for facilitator */}
                {isShortlist && isFacilitator && (
                  <label
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    <input
                      data-part="shortlist-checkbox"
                      type="checkbox"
                      aria-label="Add to shortlist"
                      checked={shortlistSelected.has(idea.idea_ref)}
                      onChange={() => handleShortlistToggle(idea.idea_ref)}
                    />
                    Shortlist
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* shortlistPanel — visible during shortlist phase */}
      {isShortlist && (
        <div
          data-part="shortlist-panel"
          style={{
            fontSize: '13px',
            color: 'var(--palette-on-surface-variant, #666)',
            margin: 0,
          }}
        >
          {isFacilitator
            ? `Select ideas to shortlist (${shortlistSelected.size} selected).`
            : 'The facilitator is shortlisting ideas.'}
        </div>
      )}

      {/* facilitatorControls — hidden when not a facilitator */}
      {isFacilitator && (
        <div
          data-part="facilitator-controls"
          role="group"
          aria-label="Facilitator controls"
          aria-hidden="false"
          style={facilitatorBarStyle}
        >
          <span style={facilitatorLabelStyle}>Facilitator</span>

          {/* closeSubmissionButton — only in submit phase */}
          {isSubmitting && (
            <button
              data-part="close-submission-button"
              type="button"
              disabled={isBusy}
              onClick={() => void handleCloseSubmission()}
              style={dangerButtonStyle(isBusy)}
            >
              Close submissions
            </button>
          )}

          {/* shortlistApplyButton — only in shortlist phase */}
          {isShortlist && (
            <button
              data-part="shortlist-apply-button"
              type="button"
              disabled={isBusy || shortlistSelected.size === 0}
              onClick={() => void handleShortlistApply()}
              style={primaryButtonStyle(isBusy || shortlistSelected.size === 0)}
            >
              Apply shortlist &amp; close
            </button>
          )}

          {/* closeBoardButton — only in shortlist phase */}
          {isShortlist && (
            <button
              data-part="close-board-button"
              type="button"
              aria-label="Close board"
              disabled={isBusy}
              onClick={() => void handleCloseBoard()}
              style={dangerButtonStyle(isBusy)}
            >
              Close board (auto)
            </button>
          )}
        </div>
      )}

      {/* result — read-only summary shown in closed state */}
      {isClosed && (
        <div
          data-part="result"
          aria-live="assertive"
          aria-atomic="true"
          style={resultStyle}
        >
          <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: 'var(--palette-on-surface-variant)' }}>
            Brainstorm complete
          </p>
          {shortlistedIdeas.length > 0 ? (
            <>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--palette-on-surface-variant, #666)' }}>
                {shortlistedIdeas.length} idea{shortlistedIdeas.length !== 1 ? 's' : ''} shortlisted
              </p>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '13px', color: 'var(--palette-on-surface, #111)' }}>
                {shortlistedIdeas.map((i) => (
                  <li key={i.idea_ref}>{i.idea_ref}</li>
                ))}
              </ul>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--palette-on-surface-variant, #666)' }}>
              {ideas.length} idea{ideas.length !== 1 ? 's' : ''} collected. See results above.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default BrainstormWidget;
