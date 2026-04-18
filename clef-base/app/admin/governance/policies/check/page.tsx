'use client';

/**
 * /admin/governance/policies/check
 *
 * Evaluate policy compliance for any action + subject combination.
 * Renders a form with actionContext / subjectId / resourceId inputs
 * that feed into PolicyCompliancePanel.
 *
 * Card: MAG-985
 */

import React, { useState } from 'react';
import { PolicyCompliancePanel } from '../../../../components/widgets/PolicyCompliancePanel';

export default function PolicyCheckPage() {
  const [actionContext, setActionContext] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [submitted, setSubmitted] = useState(false);
  // Key forces PolicyCompliancePanel to remount and re-evaluate on each submit
  const [evalKey, setEvalKey] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionContext.trim() || !subjectId.trim()) return;
    setEvalKey((k) => k + 1);
    setSubmitted(true);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-xl, 24px)',
        maxWidth: 640,
        padding: 'var(--spacing-xl, 24px)',
      }}
    >
      <div>
        <h1
          style={{
            fontSize: 'var(--typography-heading-md-size, 1.25rem)',
            fontWeight: 'var(--typography-heading-md-weight, 600)',
            marginBottom: 'var(--spacing-sm, 8px)',
          }}
        >
          Policy Check
        </h1>
        <p
          style={{
            fontSize: '0.875rem',
            color: 'var(--palette-on-surface-variant, #666)',
          }}
        >
          Evaluate policy compliance for any action + subject combination. Enter an action context
          and subject identifier to see which policy clauses apply and whether the action is
          permitted, warned, or blocked.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-md, 16px)',
          background: 'var(--palette-surface-container, #f5f5f5)',
          border: '1px solid var(--palette-outline-variant, #ddd)',
          borderRadius: 'var(--radius-card, 8px)',
          padding: 'var(--spacing-lg, 20px)',
        }}
      >
        <div>
          <label
            htmlFor="policy-check-action"
            style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 500,
              color: 'var(--palette-on-surface-variant, #666)',
              marginBottom: 4,
            }}
          >
            Action Context
          </label>
          <input
            id="policy-check-action"
            type="text"
            placeholder="e.g. publish, delete, approve"
            value={actionContext}
            onChange={(e) => setActionContext(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '6px 10px',
              border: '1px solid var(--palette-outline, #bbb)',
              borderRadius: 'var(--radius-sm, 4px)',
              fontSize: '0.875rem',
              background: 'var(--palette-surface, #fff)',
              color: 'var(--palette-on-surface, #000)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label
            htmlFor="policy-check-subject"
            style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 500,
              color: 'var(--palette-on-surface-variant, #666)',
              marginBottom: 4,
            }}
          >
            Subject ID
          </label>
          <input
            id="policy-check-subject"
            type="text"
            placeholder="e.g. user:alice or entity:doc-123"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '6px 10px',
              border: '1px solid var(--palette-outline, #bbb)',
              borderRadius: 'var(--radius-sm, 4px)',
              fontSize: '0.875rem',
              background: 'var(--palette-surface, #fff)',
              color: 'var(--palette-on-surface, #000)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label
            htmlFor="policy-check-resource"
            style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 500,
              color: 'var(--palette-on-surface-variant, #666)',
              marginBottom: 4,
            }}
          >
            Resource ID{' '}
            <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span>
          </label>
          <input
            id="policy-check-resource"
            type="text"
            placeholder="e.g. doc:report-q1"
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px',
              border: '1px solid var(--palette-outline, #bbb)',
              borderRadius: 'var(--radius-sm, 4px)',
              fontSize: '0.875rem',
              background: 'var(--palette-surface, #fff)',
              color: 'var(--palette-on-surface, #000)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          type="submit"
          data-part="button"
          data-variant="primary"
          disabled={!actionContext.trim() || !subjectId.trim()}
          style={{ alignSelf: 'flex-start' }}
        >
          Evaluate
        </button>
      </form>

      {submitted && (
        <PolicyCompliancePanel
          key={evalKey}
          actionContext={actionContext.trim()}
          subjectId={subjectId.trim()}
          resourceId={resourceId.trim() || undefined}
          autoEvaluate={true}
        />
      )}

      {!submitted && (
        <PolicyCompliancePanel
          actionContext=""
          subjectId=""
          autoEvaluate={false}
        />
      )}
    </div>
  );
}
