/* ---------------------------------------------------------------------------
 * TraceTree — Server Component
 *
 * Hierarchical execution trace viewer displaying agent loop iterations,
 * LLM calls, tool invocations with duration and token metrics.
 * ------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface TraceSpan {
  id: string;
  type: string;
  label: string;
  duration: number;
  tokens?: number | undefined;
  status: string;
  children?: TraceSpan[];
}

export interface TraceTreeProps {
  /** Array of root-level trace spans (recursive). */
  spans: TraceSpan[];
  /** Label for the root trace. */
  rootLabel: string;
  /** Total execution duration in milliseconds. */
  totalDuration?: number | undefined;
  /** Total token count across all spans. */
  totalTokens?: number | undefined;
  /** ID of the currently selected span. */
  selectedSpanId?: string | undefined;
  /** IDs of expanded spans. */
  expandedIds?: string[];
  /** Span types to display. */
  visibleTypes?: string[];
  /** Show duration and token metrics. */
  showMetrics?: boolean;
}

/* ---------------------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------------------- */

const SPAN_TYPE_LABELS: Record<string, string> = {
  llm: 'LLM',
  tool: 'Tool',
  chain: 'Chain',
  agent: 'Agent',
};

const SPAN_TYPE_ICONS: Record<string, string> = {
  llm: '\uD83E\uDDE0',
  tool: '\u2699',
  chain: '\uD83D\uDD17',
  agent: '\uD83E\uDD16',
};

const STATUS_ICONS: Record<string, string> = {
  success: '\u2713',
  running: '\u25CB',
  error: '\u2717',
  pending: '\u2022',
};

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function findSpan(spans: TraceSpan[], id: string): TraceSpan | undefined {
  for (const span of spans) {
    if (span.id === id) return span;
    if (span.children?.length) {
      const found = findSpan(span.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

function collectTypes(spans: TraceSpan[]): string[] {
  const types = new Set<string>();
  function walk(nodes: TraceSpan[]) {
    for (const s of nodes) {
      types.add(s.type);
      if (s.children?.length) walk(s.children);
    }
  }
  walk(spans);
  return Array.from(types);
}

/* ---------------------------------------------------------------------------
 * SpanNode — recursive tree rendering
 * ------------------------------------------------------------------------- */

function SpanNode({
  span,
  depth,
  expandedSet,
  visibleSet,
  selectedId,
  showMetrics,
}: {
  span: TraceSpan;
  depth: number;
  expandedSet: Set<string>;
  visibleSet: Set<string>;
  selectedId: string | undefined;
  showMetrics: boolean;
}) {
  const hasChildren = !!(span.children?.length);
  const isExpanded = expandedSet.has(span.id);
  const isSelected = selectedId === span.id;
  const visibleChildren = span.children?.filter((c) => visibleSet.has(c.type)) ?? [];

  return (
    <div
      role="treeitem"
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isSelected}
      aria-label={`${span.type}: ${span.label} (${span.duration}ms)`}
      aria-level={depth + 1}
      data-part="span-node"
      data-type={span.type}
      data-status={span.status}
      data-id={span.id}
      tabIndex={isSelected ? 0 : -1}
      style={{ paddingLeft: `${depth * 16}px` }}
    >
      {hasChildren && (
        <span data-part="expand-toggle" aria-hidden="true">
          {isExpanded ? '\u25BC' : '\u25B6'}
        </span>
      )}

      <span data-part="span-icon" data-type={span.type} aria-hidden="true">
        {SPAN_TYPE_ICONS[span.type] ?? '\u25CF'}
      </span>

      <span data-part="span-label">{span.label}</span>

      <span data-part="span-duration">{`${span.duration}ms`}</span>

      {showMetrics && span.tokens != null && (
        <span data-part="span-tokens" data-visible="true">
          {`${span.tokens} tok`}
        </span>
      )}

      <span data-part="span-status" data-status={span.status}>
        {STATUS_ICONS[span.status] ?? '\u2022'}
      </span>

      {hasChildren && isExpanded && visibleChildren.length > 0 && (
        <div data-part="span-children" role="group" data-visible="true">
          {visibleChildren.map((child) => (
            <SpanNode
              key={child.id}
              span={child}
              depth={depth + 1}
              expandedSet={expandedSet}
              visibleSet={visibleSet}
              selectedId={selectedId}
              showMetrics={showMetrics}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function TraceTree({
  spans,
  rootLabel,
  totalDuration,
  totalTokens,
  selectedSpanId,
  expandedIds = [],
  visibleTypes = ['llm', 'tool', 'chain', 'agent'],
  showMetrics = true,
}: TraceTreeProps) {
  const state = selectedSpanId ? 'spanSelected' : 'idle';
  const expandedSet = new Set(expandedIds);
  const visibleSet = new Set(visibleTypes);
  const availableTypes = collectTypes(spans);
  const visibleSpans = spans.filter((s) => visibleSet.has(s.type));
  const selectedSpan = selectedSpanId ? findSpan(spans, selectedSpanId) : undefined;

  return (
    <div
      role="group"
      aria-label="Execution trace"
      data-surface-widget=""
      data-widget-name="trace-tree"
      data-part="root"
      data-state={state}
    >
      {/* Header */}
      <div
        data-part="header"
        data-duration={totalDuration ?? undefined}
        data-tokens={totalTokens ?? undefined}
      >
        <span data-part="root-label">{rootLabel}</span>

        {showMetrics && totalDuration != null && (
          <span data-part="total-duration">{`${totalDuration}ms`}</span>
        )}

        {showMetrics && totalTokens != null && (
          <span data-part="total-tokens">{`${totalTokens} tokens`}</span>
        )}
      </div>

      {/* Filter bar */}
      <div data-part="filter-bar" role="toolbar" aria-label="Span type filters">
        {availableTypes.map((spanType) => (
          <button
            key={spanType}
            type="button"
            role="checkbox"
            aria-checked={visibleSet.has(spanType)}
            aria-label={`Filter ${SPAN_TYPE_LABELS[spanType] ?? spanType}`}
            data-part="filter-toggle"
            data-type={spanType}
            data-active={visibleSet.has(spanType) ? 'true' : 'false'}
            tabIndex={0}
          >
            {SPAN_TYPE_LABELS[spanType] ?? spanType}
          </button>
        ))}
      </div>

      {/* Tree */}
      <div data-part="tree" role="tree" aria-label="Trace spans">
        {visibleSpans.map((span) => (
          <SpanNode
            key={span.id}
            span={span}
            depth={0}
            expandedSet={expandedSet}
            visibleSet={visibleSet}
            selectedId={selectedSpanId}
            showMetrics={showMetrics}
          />
        ))}
      </div>

      {/* Detail panel */}
      <div
        data-part="detail-panel"
        role="complementary"
        aria-label="Span details"
        data-visible={state === 'spanSelected' ? 'true' : 'false'}
      >
        {selectedSpan && (
          <>
            <div data-part="detail-header">
              <span data-part="detail-type" data-type={selectedSpan.type}>
                {SPAN_TYPE_ICONS[selectedSpan.type] ?? '\u25CF'} {SPAN_TYPE_LABELS[selectedSpan.type] ?? selectedSpan.type}
              </span>
              <button
                type="button"
                data-part="detail-close"
                aria-label="Close detail panel"
                tabIndex={0}
              >
                {'\u2715'}
              </button>
            </div>

            <div data-part="detail-body">
              <div data-part="detail-field">
                <span data-part="detail-label">Label</span>
                <span data-part="detail-value">{selectedSpan.label}</span>
              </div>
              <div data-part="detail-field">
                <span data-part="detail-label">Status</span>
                <span data-part="detail-value" data-status={selectedSpan.status}>
                  {STATUS_ICONS[selectedSpan.status] ?? '\u2022'} {selectedSpan.status}
                </span>
              </div>
              <div data-part="detail-field">
                <span data-part="detail-label">Duration</span>
                <span data-part="detail-value">{`${selectedSpan.duration}ms`}</span>
              </div>
              {selectedSpan.tokens != null && (
                <div data-part="detail-field">
                  <span data-part="detail-label">Tokens</span>
                  <span data-part="detail-value">{selectedSpan.tokens}</span>
                </div>
              )}
              {selectedSpan.children && selectedSpan.children.length > 0 && (
                <div data-part="detail-field">
                  <span data-part="detail-label">Children</span>
                  <span data-part="detail-value">{selectedSpan.children.length} spans</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export { TraceTree };
