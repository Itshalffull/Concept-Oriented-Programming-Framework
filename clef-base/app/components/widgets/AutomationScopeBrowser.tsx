'use client';

/**
 * AutomationScopeBrowser — React adapter for the automation-scope-browser.widget spec.
 *
 * Read-only component that displays the active AutomationScope's allowed/denied
 * action references grouped by category. Queries AutomationScope/list_rules
 * through the Clef kernel via useKernelInvoke.
 *
 * Widget spec: surface/widgets/automation-scope-browser.widget
 * Anatomy parts (data-part): root, header, modeBadge, ruleList, categoryGroup,
 *   categoryLabel, ruleRow, rulePattern, ruleIndicator, emptyState, loadingState
 *
 * FSM states (data-state on root): loading, ready, error
 *
 * This is a read-only browser. The full scope admin editor is MAG-704.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';
import { Badge } from './Badge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScopeRule {
  action_pattern: string;
  category: string;
}

type BrowserFsmState = 'loading' | 'ready' | 'error';

export interface AutomationScopeBrowserProps {
  /** Explicit scope ID — if omitted the component queries the active scope */
  scopeId?: string;
}

// ---------------------------------------------------------------------------
// AutomationScopeBrowser
// ---------------------------------------------------------------------------

export const AutomationScopeBrowser: React.FC<AutomationScopeBrowserProps> = ({
  scopeId,
}) => {
  const invoke = useKernelInvoke();

  const [fsmState, setFsmState] = useState<BrowserFsmState>('loading');
  const [mode, setMode] = useState<string>('allowlist');
  const [rules, setRules] = useState<ScopeRule[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const load = useCallback(async () => {
    setFsmState('loading');
    setErrorMsg('');
    try {
      const result = await invoke('AutomationScope', 'list_rules', {
        scope: scopeId ?? 'active',
      });
      if (result.variant === 'ok') {
        setRules(Array.isArray(result.rules) ? (result.rules as ScopeRule[]) : []);
        setMode(typeof result.mode === 'string' ? result.mode : 'allowlist');
        setFsmState('ready');
      } else {
        setErrorMsg(`Could not load scope rules (${result.variant}).`);
        setFsmState('error');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load scope rules.');
      setFsmState('error');
    }
  }, [invoke, scopeId]);

  useEffect(() => {
    load();
  }, [load]);

  // Group rules by category
  const grouped: Record<string, ScopeRule[]> = {};
  for (const rule of rules) {
    const cat = rule.category || 'uncategorized';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(rule);
  }
  const categories = Object.keys(grouped).sort();

  const modeColor =
    mode === 'allowlist' ? 'var(--palette-primary)' : 'var(--palette-error)';

  return (
    <div
      data-part="root"
      data-state={fsmState}
      data-mode={mode}
      role="region"
      aria-label="Automation scope browser"
      aria-busy={fsmState === 'loading' ? 'true' : 'false'}
      style={{ padding: 'var(--spacing-md, 16px)' }}
    >
      {/* Header */}
      <div
        data-part="header"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm, 8px)',
          marginBottom: 'var(--spacing-md, 16px)',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 'var(--typography-body-sm-size, 0.875rem)' }}>
          Mode:
        </span>
        <span
          data-part="modeBadge"
          role="status"
          aria-live="polite"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 10px',
            borderRadius: 'var(--radius-full, 9999px)',
            background: mode === 'allowlist'
              ? 'var(--palette-primary-container)'
              : 'var(--palette-error-container)',
            color: modeColor,
            fontWeight: 600,
            fontSize: 'var(--typography-body-sm-size, 0.8rem)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {mode}
        </span>

        <button
          type="button"
          onClick={load}
          aria-label="Refresh scope rules"
          title="Refresh (F5)"
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--palette-primary)',
            fontSize: 'var(--typography-body-sm-size, 0.875rem)',
          }}
        >
          Refresh
        </button>
      </div>

      {/* Loading */}
      {fsmState === 'loading' && (
        <div
          data-part="loadingState"
          style={{ color: 'var(--palette-on-surface-variant)', fontSize: 'var(--typography-body-sm-size, 0.875rem)' }}
        >
          Loading scope rules…
        </div>
      )}

      {/* Error */}
      {fsmState === 'error' && (
        <div
          role="alert"
          style={{
            color: 'var(--palette-error)',
            fontSize: 'var(--typography-body-sm-size, 0.875rem)',
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Empty state */}
      {fsmState === 'ready' && rules.length === 0 && (
        <div
          data-part="emptyState"
          role="status"
          style={{ color: 'var(--palette-on-surface-variant)', fontSize: 'var(--typography-body-sm-size, 0.875rem)' }}
        >
          No scope rules configured. In {mode} mode with no rules, all actions are{' '}
          {mode === 'allowlist' ? 'denied' : 'permitted'}.
        </div>
      )}

      {/* Rule list — grouped by category */}
      {fsmState === 'ready' && rules.length > 0 && (
        <div
          data-part="ruleList"
          role="list"
          aria-label="Scope rules"
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md, 16px)' }}
        >
          {categories.map((cat) => (
            <div key={cat} data-part="categoryGroup">
              {/* Category heading */}
              <div
                data-part="categoryLabel"
                style={{
                  fontSize: 'var(--typography-body-sm-size, 0.8rem)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--palette-on-surface-variant)',
                  marginBottom: 'var(--spacing-xs, 4px)',
                }}
              >
                {cat}
              </div>

              {/* Rules in category */}
              {grouped[cat].map((rule, i) => (
                <div
                  key={i}
                  data-part="ruleRow"
                  role="listitem"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-sm, 8px)',
                    padding: 'var(--spacing-xs, 4px) 0',
                    borderTop: i > 0 ? '1px solid var(--palette-outline-variant)' : undefined,
                  }}
                >
                  {/* Indicator dot */}
                  <span
                    data-part="ruleIndicator"
                    aria-hidden="true"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      flexShrink: 0,
                      background:
                        mode === 'allowlist'
                          ? 'var(--palette-success, #16a34a)'
                          : 'var(--palette-error, #dc2626)',
                    }}
                  />

                  {/* Pattern */}
                  <code
                    data-part="rulePattern"
                    style={{
                      fontFamily: 'var(--typography-mono-family, monospace)',
                      fontSize: 'var(--typography-body-sm-size, 0.875rem)',
                      flex: 1,
                    }}
                  >
                    {rule.action_pattern}
                  </code>

                  {/* Mode badge per row */}
                  <Badge variant={mode === 'allowlist' ? 'success' : 'error'}>
                    {mode === 'allowlist' ? 'allowed' : 'denied'}
                  </Badge>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AutomationScopeBrowser;
