export type AuditReportState = 'idle' | 'filtering' | 'vulnSelected';
export type AuditReportEvent =
  | { type: 'FILTER'; severity?: Severity }
  | { type: 'SELECT_VULN'; id: string }
  | { type: 'CLEAR' }
  | { type: 'DESELECT' };

export function auditReportReducer(state: AuditReportState, event: AuditReportEvent): AuditReportState {
  switch (state) {
    case 'idle':
      if (event.type === 'FILTER') return 'filtering';
      if (event.type === 'SELECT_VULN') return 'vulnSelected';
      return state;
    case 'filtering':
      if (event.type === 'CLEAR') return 'idle';
      return state;
    case 'vulnSelected':
      if (event.type === 'DESELECT') return 'idle';
      return state;
    default:
      return state;
  }
}

import React, { forwardRef, useReducer, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';

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

export interface AuditReportProps {
  vulnerabilities: Vulnerability[];
  severityCounts?: Record<Severity, number>;
  lastScan: string;
  status: string;
  filterSeverity?: Severity | undefined;
  showRemediation?: boolean;
  children?: ReactNode;
}

const AuditReport = forwardRef<View, AuditReportProps>(function AuditReport(
  {
    vulnerabilities,
    severityCounts: severityCountsProp,
    lastScan,
    status,
    filterSeverity: initialFilter,
    showRemediation = true,
    children,
  },
  ref,
) {
  const [state, send] = useReducer(auditReportReducer, initialFilter ? 'filtering' : 'idle');
  const activeFilterRef = useRef<Severity | undefined>(initialFilter);
  const selectedIdRef = useRef<string | null>(null);

  const counts = useMemo(
    () => severityCountsProp ?? countBySeverity(vulnerabilities),
    [severityCountsProp, vulnerabilities],
  );

  const sorted = useMemo(
    () => [...vulnerabilities].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]),
    [vulnerabilities],
  );

  const displayed = useMemo(() => {
    if (state !== 'filtering' || !activeFilterRef.current) return sorted;
    return sorted.filter((v) => v.severity === activeFilterRef.current);
  }, [sorted, state]);

  const total = useMemo(() => Object.values(counts).reduce((sum, n) => sum + n, 0), [counts]);

  const handleFilter = useCallback((sev: Severity) => {
    activeFilterRef.current = sev;
    send({ type: 'FILTER', severity: sev });
  }, []);

  const handleClearFilter = useCallback(() => {
    activeFilterRef.current = undefined;
    send({ type: 'CLEAR' });
  }, []);

  const handleSelectVuln = useCallback((id: string) => {
    selectedIdRef.current = selectedIdRef.current === id ? null : id;
    if (selectedIdRef.current) {
      send({ type: 'SELECT_VULN', id });
    } else {
      send({ type: 'DESELECT' });
    }
  }, []);

  return (
    <View ref={ref} testID="audit-report" accessibilityRole="none" accessibilityLabel="Security audit report" style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.statusText}>{status}</Text>
        <Text style={s.lastScan}>Last scan: {lastScan}</Text>
      </View>

      {/* Severity distribution bar */}
      <View style={s.chartBar} accessibilityRole="image" accessibilityLabel="Vulnerability severity distribution">
        {ALL_SEVERITIES.map((sev) =>
          counts[sev] > 0 ? (
            <View
              key={sev}
              style={{
                flex: counts[sev] / (total || 1),
                backgroundColor: SEVERITY_COLORS[sev],
                height: 8,
              }}
            />
          ) : null,
        )}
      </View>

      {/* Severity count badges */}
      <View style={s.badgeRow}>
        {ALL_SEVERITIES.map((sev) => {
          const isActive = activeFilterRef.current === sev && state === 'filtering';
          return (
            <Pressable
              key={sev}
              onPress={() => {
                if (isActive) handleClearFilter();
                else handleFilter(sev);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${counts[sev]} ${sev}`}
              style={[s.badge, {
                borderColor: SEVERITY_COLORS[sev],
                backgroundColor: isActive ? SEVERITY_COLORS[sev] : SEVERITY_BG[sev],
              }]}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: isActive ? '#fff' : SEVERITY_COLORS[sev] }}>
                {counts[sev]} {sev}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Vulnerability list */}
      <ScrollView style={s.vulnList}>
        {displayed.map((vuln) => {
          const isExpanded = selectedIdRef.current === vuln.id && state === 'vulnSelected';
          return (
            <Pressable
              key={vuln.id}
              onPress={() => handleSelectVuln(vuln.id)}
              accessibilityRole="none"
              accessibilityLabel={`${vuln.title} \u2014 ${vuln.severity}`}
              style={[s.vulnItem, {
                borderColor: isExpanded ? SEVERITY_COLORS[vuln.severity] : '#e5e7eb',
                borderLeftColor: SEVERITY_COLORS[vuln.severity],
                backgroundColor: isExpanded ? SEVERITY_BG[vuln.severity] : 'transparent',
              }]}
            >
              <View style={s.vulnSummary}>
                <View style={[s.sevBadge, { backgroundColor: SEVERITY_COLORS[vuln.severity] }]}>
                  <Text style={s.sevBadgeText}>{vuln.severity.toUpperCase()}</Text>
                </View>
                <Text style={s.vulnTitle} numberOfLines={isExpanded ? undefined : 1}>{vuln.title}</Text>
                <Text style={s.vulnPackage}>{vuln.package}@{vuln.installedVersion}</Text>
              </View>

              {isExpanded && (
                <View style={s.vulnDetail}>
                  <Text style={s.vulnDescription}>{vuln.description}</Text>

                  {showRemediation && (
                    <View style={s.remediation}>
                      {vuln.patchedVersion ? (
                        <Text style={s.remediationText}>Fix: Upgrade {vuln.package} to {vuln.patchedVersion}</Text>
                      ) : (
                        <Text style={s.noFixText}>No patch available</Text>
                      )}
                    </View>
                  )}

                  {vuln.url && (
                    <Text style={s.advisoryLink}>View advisory: {vuln.url}</Text>
                  )}
                </View>
              )}
            </Pressable>
          );
        })}

        {displayed.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyText}>
              {state === 'filtering' ? 'No vulnerabilities match the selected severity.' : 'No vulnerabilities found.'}
            </Text>
          </View>
        )}
      </ScrollView>

      {children}
    </View>
  );
});

const s = StyleSheet.create({
  root: { padding: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusText: { fontSize: 14, fontWeight: '700' },
  lastScan: { fontSize: 12, color: '#6b7280' },
  chartBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, borderWidth: 1 },
  vulnList: { flex: 1 },
  vulnItem: { borderWidth: 1, borderLeftWidth: 4, borderRadius: 6, padding: 12, marginBottom: 8 },
  vulnSummary: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  sevBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 99 },
  sevBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  vulnTitle: { fontSize: 14, fontWeight: '600', flex: 1 },
  vulnPackage: { fontSize: 12, color: '#6b7280' },
  vulnDetail: { marginTop: 10 },
  vulnDescription: { fontSize: 13, lineHeight: 20, marginBottom: 8 },
  remediation: { marginBottom: 6 },
  remediationText: { fontSize: 12, color: '#374151' },
  noFixText: { fontSize: 12, color: '#b91c1c' },
  advisoryLink: { fontSize: 12, color: '#2563eb', marginTop: 4 },
  empty: { padding: 16, alignItems: 'center' },
  emptyText: { color: '#9ca3af', fontSize: 13 },
});

AuditReport.displayName = 'AuditReport';
export { AuditReport };
export default AuditReport;
