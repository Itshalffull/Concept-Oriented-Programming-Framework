export type AuditReportState = 'idle' | 'filtering' | 'vulnSelected';
export type AuditReportEvent =
  | { type: 'FILTER' }
  | { type: 'SELECT_VULN' }
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

import React, { useReducer } from 'react';
import { View, Text, Pressable } from 'react-native';

export interface AuditReportProps {
  vulnerabilities: unknown[];
  severityCounts: unknown[];
  lastScan: string;
  status: string;
  filterSeverity?: string | undefined;
  showRemediation?: boolean;
}

export function AuditReport(props: AuditReportProps) {
  const [state, send] = useReducer(auditReportReducer, 'idle');

  return (
    <View
      accessibilityRole="none"
      accessibilityLabel="Security audit report panel showing vuln"
      data-widget="audit-report"
      data-state={state}
    >
      <View>{/* header: Scan status and timestamp */}</View>
      <View>{/* severityChart: Severity distribution bar chart */}</View>
      <View>{/* criticalCount: Critical severity count badge */}</View>
      <View>{/* highCount: High severity count badge */}</View>
      <View>{/* mediumCount: Medium severity count badge */}</View>
    </View>
  );
}

export default AuditReport;
