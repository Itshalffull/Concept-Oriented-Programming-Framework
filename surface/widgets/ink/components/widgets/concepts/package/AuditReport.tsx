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

import React, { useReducer, useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface Vulnerability {
  id: string;
  package: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  title: string;
  fixAvailable?: boolean;
  remediation?: string;
}

interface SeverityCount {
  severity: string;
  count: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'red',
  high: 'red',
  moderate: 'yellow',
  low: 'gray',
};

const SEVERITY_ICONS: Record<string, string> = {
  critical: '\u2622',
  high: '\u26A0',
  moderate: '\u25CF',
  low: '\u25CB',
};

export interface AuditReportProps {
  vulnerabilities: Vulnerability[];
  severityCounts: SeverityCount[];
  lastScan: string;
  status: string;
  filterSeverity?: string | undefined;
  showRemediation?: boolean;
  onSelectVuln?: (id: string) => void;
  isFocused?: boolean;
}

export function AuditReport({
  vulnerabilities,
  severityCounts,
  lastScan,
  status,
  filterSeverity,
  showRemediation = false,
  onSelectVuln,
  isFocused = false,
}: AuditReportProps) {
  const [state, send] = useReducer(auditReportReducer, 'idle');
  const [cursorIndex, setCursorIndex] = useState(0);

  const filtered = filterSeverity
    ? vulnerabilities.filter(v => v.severity === filterSeverity)
    : vulnerabilities;

  useInput((input, key) => {
    if (!isFocused) return;
    if (key.upArrow || input === 'k') {
      setCursorIndex(prev => Math.max(0, prev - 1));
    }
    if (key.downArrow || input === 'j') {
      setCursorIndex(prev => Math.min(filtered.length - 1, prev + 1));
    }
    if (key.return) {
      const vuln = filtered[cursorIndex];
      if (vuln) {
        if (state === 'vulnSelected') send({ type: 'DESELECT' });
        else {
          send({ type: 'SELECT_VULN' });
          onSelectVuln?.(vuln.id);
        }
      }
    }
    if (key.escape) send({ type: 'DESELECT' });
  });

  const totalVulns = vulnerabilities.length;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={isFocused ? 'cyan' : undefined}>
      <Box justifyContent="space-between">
        <Text bold>Security Audit</Text>
        <Text color="gray">Last scan: {lastScan}</Text>
      </Box>

      {/* Severity distribution */}
      <Box marginTop={1}>
        {severityCounts.map(sc => {
          const color = SEVERITY_COLORS[sc.severity] ?? 'white';
          const barWidth = totalVulns > 0 ? Math.max(1, Math.round((sc.count / totalVulns) * 20)) : 0;
          return (
            <Box key={sc.severity} marginRight={1}>
              <Text color={color}>
                {sc.severity.charAt(0).toUpperCase()}: {sc.count}
              </Text>
              <Text color={color}>{' '}{'\u2588'.repeat(barWidth)}</Text>
            </Box>
          );
        })}
      </Box>

      {/* Vulnerability list */}
      <Box flexDirection="column" marginTop={1}>
        {filtered.length === 0 && (
          <Text color="green">{'\u2713'} No vulnerabilities found</Text>
        )}
        {filtered.map((vuln, i) => {
          const isCursor = i === cursorIndex && isFocused;
          const isSelected = i === cursorIndex && state === 'vulnSelected';
          const sevColor = SEVERITY_COLORS[vuln.severity] ?? 'white';
          const sevIcon = SEVERITY_ICONS[vuln.severity] ?? '\u25CF';

          return (
            <Box key={vuln.id} flexDirection="column">
              <Box>
                <Text color={isCursor ? 'cyan' : undefined}>
                  {isCursor ? '\u25B6 ' : '  '}
                </Text>
                <Text color={sevColor}>{sevIcon} </Text>
                <Text bold={isSelected}>{vuln.title}</Text>
                <Text color="gray"> ({vuln.package})</Text>
                {vuln.fixAvailable && <Text color="green"> [fix available]</Text>}
              </Box>
              {isSelected && showRemediation && vuln.remediation && (
                <Box paddingLeft={4}>
                  <Text color="gray" wrap="wrap">Fix: {vuln.remediation}</Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {isFocused && (
        <Box marginTop={1}>
          <Text color="gray">[{'\u2191\u2193'}] Nav [Enter] Details</Text>
        </Box>
      )}
    </Box>
  );
}

export default AuditReport;
