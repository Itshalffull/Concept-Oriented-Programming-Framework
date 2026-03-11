import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

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

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  moderate: '#ca8a04',
  low: '#2563eb',
};

const SEVERITY_BG: Record<string, string> = {
  critical: '#fef2f2',
  high: '#fff7ed',
  moderate: '#fefce8',
  low: '#eff6ff',
};

const ALL_SEVERITIES = ['critical', 'high', 'moderate', 'low'] as const;

export interface AuditReportProps { [key: string]: unknown; class?: string; }
export interface AuditReportResult { element: HTMLElement; dispose: () => void; }

export function AuditReport(props: AuditReportProps): AuditReportResult {
  const sig = surfaceCreateSignal<AuditReportState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(auditReportReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];
  let activeFilter: string | undefined;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'audit-report');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Security audit report');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Header */
  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  headerEl.setAttribute('data-state', state());
  const statusSpan = document.createElement('span');
  statusSpan.setAttribute('data-part', 'status');
  statusSpan.textContent = 'Scanned';
  headerEl.appendChild(statusSpan);
  const lastScanSpan = document.createElement('span');
  lastScanSpan.setAttribute('data-part', 'last-scan');
  lastScanSpan.textContent = 'Last scan: —';
  headerEl.appendChild(lastScanSpan);
  root.appendChild(headerEl);

  /* Severity chart bar */
  const severityChartEl = document.createElement('div');
  severityChartEl.setAttribute('data-part', 'severity-chart');
  severityChartEl.setAttribute('data-state', state());
  severityChartEl.setAttribute('role', 'img');
  severityChartEl.setAttribute('aria-label', 'Vulnerability severity distribution');
  severityChartEl.style.display = 'flex';
  severityChartEl.style.height = '8px';
  severityChartEl.style.borderRadius = '4px';
  severityChartEl.style.overflow = 'hidden';
  for (const sev of ALL_SEVERITIES) {
    const seg = document.createElement('div');
    seg.setAttribute('data-severity', sev);
    seg.style.flex = '1';
    seg.style.backgroundColor = SEVERITY_COLORS[sev];
    seg.title = `${sev}: 0`;
    severityChartEl.appendChild(seg);
  }
  root.appendChild(severityChartEl);

  /* Severity count filter badges */
  const severitySummaryEl = document.createElement('div');
  severitySummaryEl.setAttribute('data-part', 'severity-summary');
  severitySummaryEl.setAttribute('data-state', state());
  severitySummaryEl.style.display = 'flex';
  severitySummaryEl.style.gap = '0.5rem';
  severitySummaryEl.style.flexWrap = 'wrap';
  severitySummaryEl.style.margin = '0.5rem 0';
  const sevButtons: HTMLButtonElement[] = [];
  for (const sev of ALL_SEVERITIES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-part', sev);
    btn.setAttribute('data-state', state());
    btn.setAttribute('data-active', 'false');
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', `0 ${sev}`);
    btn.style.display = 'inline-flex';
    btn.style.alignItems = 'center';
    btn.style.gap = '0.25rem';
    btn.style.padding = '0.25rem 0.5rem';
    btn.style.border = '1px solid';
    btn.style.borderColor = SEVERITY_COLORS[sev];
    btn.style.borderRadius = '9999px';
    btn.style.backgroundColor = SEVERITY_BG[sev];
    btn.style.color = SEVERITY_COLORS[sev];
    btn.style.fontWeight = '600';
    btn.style.fontSize = '0.8125rem';
    btn.style.cursor = 'pointer';
    btn.style.lineHeight = '1';
    const countSpan = document.createElement('span');
    countSpan.textContent = '0';
    btn.appendChild(countSpan);
    const labelSpan = document.createElement('span');
    labelSpan.textContent = sev;
    btn.appendChild(labelSpan);
    btn.addEventListener('click', () => {
      if (activeFilter === sev && sig.get() === 'filtering') {
        activeFilter = undefined;
        send('CLEAR');
      } else {
        activeFilter = sev;
        send('FILTER');
      }
      for (const b of sevButtons) {
        const s = b.getAttribute('data-part') ?? '';
        const isActive = activeFilter === s && sig.get() === 'filtering';
        b.setAttribute('data-active', isActive ? 'true' : 'false');
        b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        b.style.backgroundColor = isActive ? SEVERITY_COLORS[s] : SEVERITY_BG[s];
        b.style.color = isActive ? '#fff' : SEVERITY_COLORS[s];
      }
    });
    sevButtons.push(btn);
    severitySummaryEl.appendChild(btn);
  }
  root.appendChild(severitySummaryEl);

  /* Vulnerability list */
  const vulnListEl = document.createElement('div');
  vulnListEl.setAttribute('data-part', 'vuln-list');
  vulnListEl.setAttribute('data-state', state());
  vulnListEl.setAttribute('role', 'list');
  vulnListEl.setAttribute('aria-label', 'Vulnerabilities');

  /* Template vuln item */
  const vulnItemEl = document.createElement('div');
  vulnItemEl.setAttribute('data-part', 'vuln-item');
  vulnItemEl.setAttribute('data-state', state());
  vulnItemEl.setAttribute('data-expanded', 'false');
  vulnItemEl.setAttribute('role', 'listitem');
  vulnItemEl.setAttribute('tabindex', '0');
  vulnItemEl.style.border = '1px solid #e5e7eb';
  vulnItemEl.style.borderLeft = '4px solid #ca8a04';
  vulnItemEl.style.borderRadius = '0.375rem';
  vulnItemEl.style.padding = '0.75rem';
  vulnItemEl.style.marginBottom = '0.5rem';
  vulnItemEl.style.cursor = 'pointer';
  vulnItemEl.addEventListener('click', () => {
    send('SELECT_VULN');
  });

  const vulnRow = document.createElement('div');
  vulnRow.style.display = 'flex';
  vulnRow.style.alignItems = 'center';
  vulnRow.style.gap = '0.5rem';
  vulnRow.style.flexWrap = 'wrap';

  const vulnSeverityEl = document.createElement('span');
  vulnSeverityEl.setAttribute('data-part', 'vuln-severity');
  vulnSeverityEl.setAttribute('data-state', state());
  vulnSeverityEl.style.display = 'inline-block';
  vulnSeverityEl.style.padding = '0.125rem 0.5rem';
  vulnSeverityEl.style.borderRadius = '9999px';
  vulnSeverityEl.style.fontSize = '0.75rem';
  vulnSeverityEl.style.fontWeight = '700';
  vulnSeverityEl.style.textTransform = 'uppercase';
  vulnSeverityEl.style.letterSpacing = '0.025em';
  vulnSeverityEl.style.color = '#fff';
  vulnSeverityEl.style.backgroundColor = '#ca8a04';
  vulnSeverityEl.textContent = 'moderate';
  vulnRow.appendChild(vulnSeverityEl);

  const vulnTitleEl = document.createElement('span');
  vulnTitleEl.setAttribute('data-part', 'vuln-title');
  vulnTitleEl.setAttribute('data-state', state());
  vulnTitleEl.style.fontWeight = '600';
  vulnTitleEl.style.flex = '1';
  vulnTitleEl.textContent = 'Vulnerability';
  vulnRow.appendChild(vulnTitleEl);

  const vulnPackageEl = document.createElement('span');
  vulnPackageEl.setAttribute('data-part', 'vuln-package');
  vulnPackageEl.setAttribute('data-state', state());
  vulnPackageEl.style.fontSize = '0.8125rem';
  vulnPackageEl.style.color = '#6b7280';
  vulnPackageEl.style.fontFamily = 'monospace';
  vulnPackageEl.textContent = 'package@0.0.0';
  vulnRow.appendChild(vulnPackageEl);

  vulnItemEl.appendChild(vulnRow);

  /* Vuln detail (expanded) */
  const vulnDetailEl = document.createElement('div');
  vulnDetailEl.setAttribute('data-part', 'vuln-detail');
  vulnDetailEl.setAttribute('data-state', state());
  vulnDetailEl.style.marginTop = '0.75rem';
  vulnDetailEl.style.display = 'none';

  const vulnDescEl = document.createElement('p');
  vulnDescEl.style.margin = '0 0 0.5rem';
  vulnDescEl.style.fontSize = '0.875rem';
  vulnDescEl.style.lineHeight = '1.5';
  vulnDescEl.textContent = 'Description';
  vulnDetailEl.appendChild(vulnDescEl);

  const vulnRemediationEl = document.createElement('div');
  vulnRemediationEl.setAttribute('data-part', 'remediation');
  vulnRemediationEl.setAttribute('data-state', state());
  vulnRemediationEl.setAttribute('data-visible', 'true');
  vulnRemediationEl.style.fontSize = '0.8125rem';
  vulnRemediationEl.textContent = 'No patch available';
  vulnDetailEl.appendChild(vulnRemediationEl);

  vulnItemEl.appendChild(vulnDetailEl);
  vulnListEl.appendChild(vulnItemEl);

  /* Empty state */
  const emptyEl = document.createElement('div');
  emptyEl.setAttribute('data-part', 'empty');
  emptyEl.setAttribute('data-state', state());
  emptyEl.style.padding = '1rem';
  emptyEl.style.textAlign = 'center';
  emptyEl.style.color = '#9ca3af';
  emptyEl.textContent = 'No vulnerabilities found.';
  vulnListEl.appendChild(emptyEl);

  root.appendChild(vulnListEl);

  /* Keyboard navigation */
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      send('SELECT_VULN');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (sig.get() === 'vulnSelected') {
        send('DESELECT');
      } else if (sig.get() === 'filtering') {
        activeFilter = undefined;
        send('CLEAR');
      }
    }
  });

  /* Subscribe to state changes */
  unsubs.push(sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    headerEl.setAttribute('data-state', s);
    severityChartEl.setAttribute('data-state', s);
    severitySummaryEl.setAttribute('data-state', s);
    vulnListEl.setAttribute('data-state', s);
    vulnItemEl.setAttribute('data-state', s);
    const isExpanded = s === 'vulnSelected';
    vulnItemEl.setAttribute('data-expanded', isExpanded ? 'true' : 'false');
    vulnDetailEl.style.display = isExpanded ? 'block' : 'none';
    emptyEl.textContent = s === 'filtering'
      ? 'No vulnerabilities match the selected severity.'
      : 'No vulnerabilities found.';
  }));

  return {
    element: root,
    dispose() { unsubs.forEach((u) => u()); root.remove(); },
  };
}

export default AuditReport;
