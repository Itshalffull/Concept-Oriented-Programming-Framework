'use client';

import {
  forwardRef,
  useCallback,
  useId,
  useReducer,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { backlinkPanelReducer } from './BacklinkPanel.reducer.js';

/* ---------------------------------------------------------------------------
 * Types derived from backlink-panel.widget spec props
 * ------------------------------------------------------------------------- */

export interface LinkedRef {
  sourceId: string;
  sourceTitle: string;
  sourcePath: string[];
  contextSnippet: string;
  highlightRange?: { start: number; end: number };
}

export interface UnlinkedRef {
  sourceId: string;
  sourceTitle: string;
  mentionId: string;
  contextSnippet: string;
}

export interface BacklinkPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  targetId: string;
  targetTitle: string;
  linkedReferences?: LinkedRef[];
  unlinkedMentions?: UnlinkedRef[];
  loading?: boolean;
  showUnlinked?: boolean;
  contextChars?: number;
  onNavigate?: (sourceId: string) => void;
  onLink?: (sourceId: string, mentionId: string) => void;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const BacklinkPanel = forwardRef<HTMLDivElement, BacklinkPanelProps>(
  function BacklinkPanel(
    {
      targetId,
      targetTitle,
      linkedReferences = [],
      unlinkedMentions = [],
      loading = false,
      showUnlinked = true,
      contextChars = 200,
      onNavigate,
      onLink,
      children,
      ...rest
    },
    ref,
  ) {
    const [state, send] = useReducer(backlinkPanelReducer, {
      panel: 'expanded',
      linkedSection: 'expanded',
      unlinkedSection: 'collapsed',
      loading: loading ? 'loading' : 'idle',
    });

    const panelContentId = useId();
    const titleId = useId();
    const totalCount = linkedReferences.length + unlinkedMentions.length;

    const truncate = (text: string) =>
      text.length > contextChars ? text.slice(0, contextChars) + '...' : text;

    const handleNavigate = useCallback(
      (sourceId: string) => {
        onNavigate?.(sourceId);
      },
      [onNavigate],
    );

    const handleLink = useCallback(
      (sourceId: string, mentionId: string) => {
        onLink?.(sourceId, mentionId);
      },
      [onLink],
    );

    const isEmpty = linkedReferences.length === 0 && unlinkedMentions.length === 0 && !loading;

    return (
      <div
        ref={ref}
        role="complementary"
        aria-label={`Backlinks to ${targetTitle}`}
        aria-busy={loading ? 'true' : 'false'}
        data-surface-widget=""
        data-widget-name="backlink-panel"
        data-part="root"
        data-state={state.panel}
        {...rest}
      >
        {/* Header */}
        <div data-part="header" data-state={state.panel}>
          <span data-part="title" id={titleId}>
            Backlinks
          </span>
          <span
            data-part="count"
            aria-label={`${linkedReferences.length} linked, ${unlinkedMentions.length} unlinked`}
          >
            {totalCount}
          </span>
          <button
            type="button"
            data-part="collapse-toggle"
            aria-expanded={state.panel === 'expanded' ? 'true' : 'false'}
            aria-controls={panelContentId}
            aria-label={
              state.panel === 'expanded' ? 'Collapse backlinks' : 'Expand backlinks'
            }
            onClick={() =>
              send({ type: state.panel === 'expanded' ? 'COLLAPSE' : 'EXPAND' })
            }
          >
            {state.panel === 'expanded' ? '\u25B2' : '\u25BC'}
          </button>
        </div>

        <div id={panelContentId}>
          {/* Linked Section */}
          {state.panel === 'expanded' && (
            <div
              role="region"
              aria-label="Linked mentions"
              aria-expanded={state.linkedSection === 'expanded' ? 'true' : 'false'}
              data-part="linked-section"
              data-state={state.linkedSection}
            >
              <div
                data-part="linked-section-header"
                onClick={() =>
                  send({
                    type:
                      state.linkedSection === 'expanded'
                        ? 'COLLAPSE_LINKED'
                        : 'EXPAND_LINKED',
                  })
                }
              >
                <span data-part="linked-section-label">Linked mentions</span>
                <span data-part="linked-section-count" aria-hidden="true">
                  {linkedReferences.length}
                </span>
              </div>

              {state.linkedSection === 'expanded' && (
                <div
                  role="list"
                  aria-label="Linked references"
                  data-part="linked-list"
                  data-count={linkedReferences.length}
                >
                  {linkedReferences.map((item) => (
                    <div
                      key={`${item.sourceId}-linked`}
                      role="listitem"
                      aria-label={`Reference from ${item.sourceTitle}`}
                      data-part="linked-item"
                      data-source={item.sourceId}
                      tabIndex={0}
                      onClick={() => handleNavigate(item.sourceId)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleNavigate(item.sourceId);
                      }}
                    >
                      <nav data-part="linked-item-breadcrumb">
                        {item.sourcePath.map((segment, i) => (
                          <span key={i}>
                            {i > 0 && <span aria-hidden="true"> / </span>}
                            {segment}
                          </span>
                        ))}
                      </nav>
                      <span data-part="linked-item-context">
                        {truncate(item.contextSnippet)}
                      </span>
                      {item.highlightRange && (
                        <span data-part="linked-item-highlight" aria-hidden="true" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Unlinked Section */}
          {state.panel === 'expanded' && showUnlinked && (
            <div
              role="region"
              aria-label="Unlinked mentions"
              aria-expanded={state.unlinkedSection === 'expanded' ? 'true' : 'false'}
              data-part="unlinked-section"
              data-state={state.unlinkedSection}
            >
              <div
                data-part="unlinked-section-header"
                onClick={() =>
                  send({
                    type:
                      state.unlinkedSection === 'expanded'
                        ? 'COLLAPSE_UNLINKED'
                        : 'EXPAND_UNLINKED',
                  })
                }
              >
                <span data-part="unlinked-section-label">Unlinked mentions</span>
                <span data-part="unlinked-section-count" aria-hidden="true">
                  {unlinkedMentions.length}
                </span>
              </div>

              {state.unlinkedSection === 'expanded' && (
                <div
                  role="list"
                  aria-label="Unlinked references"
                  data-part="unlinked-list"
                  data-count={unlinkedMentions.length}
                >
                  {unlinkedMentions.map((item) => (
                    <div
                      key={`${item.sourceId}-${item.mentionId}-unlinked`}
                      role="listitem"
                      aria-label={`Unlinked mention from ${item.sourceTitle}`}
                      data-part="unlinked-item"
                      data-source={item.sourceId}
                      tabIndex={0}
                      onClick={() => handleNavigate(item.sourceId)}
                    >
                      <span data-part="unlinked-item-context">
                        {truncate(item.contextSnippet)}
                      </span>
                      <button
                        type="button"
                        data-part="link-button"
                        aria-label={`Link mention from ${item.sourceTitle}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLink(item.sourceId, item.mentionId);
                        }}
                      >
                        Link
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {isEmpty && (
            <div
              data-part="empty-state"
              aria-hidden={linkedReferences.length > 0 || unlinkedMentions.length > 0 ? 'true' : 'false'}
            >
              No backlinks found
            </div>
          )}
        </div>

        {children}
      </div>
    );
  },
);

BacklinkPanel.displayName = 'BacklinkPanel';
export default BacklinkPanel;
