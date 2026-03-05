/* ---------------------------------------------------------------------------
 * AuditReport — Server Component
 *
 * Security audit report panel showing vulnerability counts by severity,
 * distribution chart, filterable vulnerability list, and expandable details.
 * ------------------------------------------------------------------------- */

import type { ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type Severity = 'critical' | 'high' | 'moderate' | 'low';

export interface Vulnerability {
  id: string;
  title: string;
  severity: Severity;
  package: string;
  installedVersion: string;
  patchedVersion?: string;
  description: string;
  url?: string;
}

export interface AuditReportProps {
  vulnerabilities: Vulnerability[];
  severityCounts?: Record<Severity, number>;
  lastScan: string;
  status: string;
  filterSeverity?: Severity | undefined;
  showRemediation?: boolean;
  /** ID of the selected vulnerability for expanded view. */
  selectedVulnId?: string | undefined;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, moderate: 2, low: 3 };

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  moderate: '#ca8a04',
  low: '#2563eb',
};

const SEVERITY_BG: Record<Severity, string> = {
  critical: '#fef2f2',
  high: '#fff7ed',
  moderate: '#fefce8',
  low: '#eff6ff',
};

const ALL_SEVERITIES: Severity[] = ['critical', 'high', 'moderate', 'low'];

function countBySeverity(vulns: Vulnerability[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, moderate: 0, low: 0 };
  for (const v of vulns) {
    if (v.severity in counts) counts[v.severity]++;
  }
  return counts;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function AuditReport({
  vulnerabilities,
  severityCounts: severityCountsProp,
  lastScan,
  status,
  filterSeverity,
  showRemediation = true,
  selectedVulnId,
  children,
}: AuditReportProps) {
  const counts = severityCountsProp ?? countBySeverity(vulnerabilities);
  const sorted = [...vulnerabilities].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const displayed = filterSeverity ? sorted.filter((v) => v.severity === filterSeverity) : sorted;
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const state = selectedVulnId ? 'vulnSelected' : (filterSeverity ? 'filtering' : 'idle');

  return (
    <div
      role="region"
      aria-label="Security audit report"
      data-surface-widget=""
      data-widget-name="audit-report"
      data-part="root"
      data-state={state}
      data-status={status}
      tabIndex={0}
    >
      {/* Header: scan status and timestamp */}
      <div data-part="header" data-state={state}>
        <span data-part="status">{status}</span>
        <span data-part="last-scan">Last scan: {lastScan}</span>
      </div>

      {/* Severity distribution bar chart */}
      <div
        data-part="severity-chart"
        data-state={state}
        role="img"
        aria-label="Vulnerability severity distribution"
        style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', gap: 0 }}
      >
        {ALL_SEVERITIES.map((sev) =>
          counts[sev] > 0 ? (
            <div
              key={sev}
              data-severity={sev}
              style={{
                flex: counts[sev] / (total || 1),
                backgroundColor: SEVERITY_COLORS[sev],
              }}
              title={`${sev}: ${counts[sev]}`}
            />
          ) : null,
        )}
      </div>

      {/* Severity count badges */}
      <div data-part="severity-summary" data-state={state} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '0.5rem 0' }}>
        {ALL_SEVERITIES.map((sev) => (
          <button
            key={sev}
            type="button"
            data-part={sev}
            data-state={state}
            data-active={filterSeverity === sev ? 'true' : 'false'}
            aria-pressed={filterSeverity === sev}
            aria-label={`${counts[sev]} ${sev}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.25rem 0.5rem',
              border: '1px solid',
              borderColor: SEVERITY_COLORS[sev],
              borderRadius: '9999px',
              backgroundColor: filterSeverity === sev ? SEVERITY_COLORS[sev] : SEVERITY_BG[sev],
              color: filterSeverity === sev ? '#fff' : SEVERITY_COLORS[sev],
              fontWeight: 600,
              fontSize: '0.8125rem',
              lineHeight: 1,
            }}
          >
            <span>{counts[sev]}</span>
            <span>{sev}</span>
          </button>
        ))}
      </div>

      {/* Vulnerability list */}
      <div
        data-part="vuln-list"
        data-state={state}
        role="list"
        aria-label="Vulnerabilities"
      >
        {displayed.map((vuln) => {
          const isExpanded = selectedVulnId === vuln.id;
          return (
            <div
              key={vuln.id}
              data-part="vuln-item"
              data-state={state}
              data-severity={vuln.severity}
              data-vuln-id={vuln.id}
              data-expanded={isExpanded ? 'true' : 'false'}
              role="listitem"
              aria-label={`${vuln.title} \u2014 ${vuln.severity}`}
              tabIndex={0}
              style={{
                border: '1px solid',
                borderColor: isExpanded ? SEVERITY_COLORS[vuln.severity] : '#e5e7eb',
                borderLeft: `4px solid ${SEVERITY_COLORS[vuln.severity]}`,
                borderRadius: '0.375rem',
                padding: '0.75rem',
                marginBottom: '0.5rem',
                backgroundColor: isExpanded ? SEVERITY_BG[vuln.severity] : 'transparent',
              }}
            >
              {/* Collapsed summary row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span
                  data-part="vuln-severity"
                  data-severity={vuln.severity}
                  data-state={state}
                  style={{
                    display: 'inline-block',
                    padding: '0.125rem 0.5rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.025em',
                    color: '#fff',
                    backgroundColor: SEVERITY_COLORS[vuln.severity],
                  }}
                >
                  {vuln.severity}
                </span>
                <span data-part="vuln-title" data-state={state} style={{ fontWeight: 600, flex: 1 }}>
                  {vuln.title}
                </span>
                <span
                  data-part="vuln-package"
                  data-state={state}
                  style={{ fontSize: '0.8125rem', color: '#6b7280', fontFamily: 'monospace' }}
                >
                  {vuln.package}@{vuln.installedVersion}
                </span>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div data-part="vuln-detail" data-state={state} style={{ marginTop: '0.75rem' }}>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', lineHeight: 1.5 }}>
                    {vuln.description}
                  </p>

                  {showRemediation && (
                    <div
                      data-part="remediation"
                      data-state={state}
                      data-visible="true"
                      style={{ fontSize: '0.8125rem' }}
                    >
                      {vuln.patchedVersion ? (
                        <span>
                          <strong>Fix:</strong> Upgrade{' '}
                          <code style={{ backgroundColor: '#f3f4f6', padding: '0.1rem 0.25rem', borderRadius: '0.25rem' }}>
                            {vuln.package}
                          </code>{' '}
                          to{' '}
                          <code style={{ backgroundColor: '#f3f4f6', padding: '0.1rem 0.25rem', borderRadius: '0.25rem' }}>
                            {vuln.patchedVersion}
                          </code>
                        </span>
                      ) : (
                        <span style={{ color: '#b91c1c' }}>No patch available</span>
                      )}
                    </div>
                  )}

                  {vuln.url && (
                    <a
                      data-part="advisory-link"
                      href={vuln.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-block',
                        marginTop: '0.5rem',
                        fontSize: '0.8125rem',
                        color: '#2563eb',
                        textDecoration: 'underline',
                      }}
                    >
                      View advisory
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {displayed.length === 0 && (
          <div data-part="empty" data-state={state} style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af' }}>
            {filterSeverity ? 'No vulnerabilities match the selected severity.' : 'No vulnerabilities found.'}
          </div>
        )}
      </div>

      {children}
    </div>
  );
}

export { AuditReport };
