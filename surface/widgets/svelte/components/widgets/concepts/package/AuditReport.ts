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

/* --- Types --- */

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
  [key: string]: unknown;
  class?: string;
  vulnerabilities: Vulnerability[];
  lastScan: string;
  status: string;
  filterSeverity?: Severity;
  showRemediation?: boolean;
}
export interface AuditReportResult { element: HTMLElement; dispose: () => void; }

/* --- Helpers --- */

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, moderate: 2, low: 3 };
const SEVERITY_COLORS: Record<Severity, string> = { critical: '#dc2626', high: '#ea580c', moderate: '#ca8a04', low: '#2563eb' };
const SEVERITY_BG: Record<Severity, string> = { critical: '#fef2f2', high: '#fff7ed', moderate: '#fefce8', low: '#eff6ff' };
const ALL_SEVERITIES: Severity[] = ['critical', 'high', 'moderate', 'low'];

function countBySeverity(vulns: Vulnerability[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, moderate: 0, low: 0 };
  for (const v of vulns) { if (v.severity in counts) counts[v.severity]++; }
  return counts;
}

/* --- Component --- */

export function AuditReport(props: AuditReportProps): AuditReportResult {
  const sig = surfaceCreateSignal<AuditReportState>(props.filterSeverity ? 'filtering' : 'idle');
  const send = (type: string) => sig.set(auditReportReducer(sig.get(), { type } as any));

  const vulns = (props.vulnerabilities ?? []) as Vulnerability[];
  const lastScan = (props.lastScan as string) ?? '';
  const status = (props.status as string) ?? '';
  const showRemediation = props.showRemediation !== false;

  let activeFilter: Severity | undefined = props.filterSeverity as Severity | undefined;
  let selectedId: string | null = null;
  let focusIndex = 0;

  const counts = countBySeverity(vulns);
  const sorted = [...vulns].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const total = Object.values(counts).reduce((s, n) => s + n, 0);

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'audit-report');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Security audit report');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('data-status', status);
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  // Header
  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  const statusSpan = document.createElement('span');
  statusSpan.setAttribute('data-part', 'status');
  statusSpan.textContent = status;
  headerEl.appendChild(statusSpan);
  const scanSpan = document.createElement('span');
  scanSpan.setAttribute('data-part', 'last-scan');
  scanSpan.textContent = `Last scan: ${lastScan}`;
  headerEl.appendChild(scanSpan);
  root.appendChild(headerEl);

  // Severity chart bar
  const chartEl = document.createElement('div');
  chartEl.setAttribute('data-part', 'severity-chart');
  chartEl.setAttribute('role', 'img');
  chartEl.setAttribute('aria-label', 'Vulnerability severity distribution');
  Object.assign(chartEl.style, { display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden' });
  for (const sev of ALL_SEVERITIES) {
    if (counts[sev] > 0) {
      const bar = document.createElement('div');
      bar.setAttribute('data-severity', sev);
      bar.style.flex = String(counts[sev] / (total || 1));
      bar.style.backgroundColor = SEVERITY_COLORS[sev];
      bar.title = `${sev}: ${counts[sev]}`;
      chartEl.appendChild(bar);
    }
  }
  root.appendChild(chartEl);

  // Severity count badges
  const summaryEl = document.createElement('div');
  summaryEl.setAttribute('data-part', 'severity-summary');
  Object.assign(summaryEl.style, { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '0.5rem 0' });
  const sevButtons: HTMLButtonElement[] = [];
  for (const sev of ALL_SEVERITIES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-part', sev);
    btn.setAttribute('aria-label', `${counts[sev]} ${sev}`);
    const isActive = activeFilter === sev && sig.get() === 'filtering';
    btn.setAttribute('aria-pressed', String(isActive));
    btn.setAttribute('data-active', isActive ? 'true' : 'false');
    Object.assign(btn.style, {
      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
      padding: '0.25rem 0.5rem', border: '1px solid', borderColor: SEVERITY_COLORS[sev],
      borderRadius: '9999px', fontWeight: '600', fontSize: '0.8125rem', cursor: 'pointer', lineHeight: '1',
      backgroundColor: isActive ? SEVERITY_COLORS[sev] : SEVERITY_BG[sev],
      color: isActive ? '#fff' : SEVERITY_COLORS[sev],
    });
    btn.innerHTML = `<span>${counts[sev]}</span><span>${sev}</span>`;
    btn.addEventListener('click', () => {
      if (activeFilter === sev && sig.get() === 'filtering') {
        activeFilter = undefined;
        send('CLEAR');
      } else {
        activeFilter = sev;
        send('FILTER');
      }
      rebuildList();
      updateSevButtons();
    });
    summaryEl.appendChild(btn);
    sevButtons.push(btn);
  }
  root.appendChild(summaryEl);

  function updateSevButtons() {
    for (const btn of sevButtons) {
      const sev = btn.getAttribute('data-part') as Severity;
      const isActive = activeFilter === sev && sig.get() === 'filtering';
      btn.setAttribute('aria-pressed', String(isActive));
      btn.setAttribute('data-active', isActive ? 'true' : 'false');
      btn.style.backgroundColor = isActive ? SEVERITY_COLORS[sev] : SEVERITY_BG[sev];
      btn.style.color = isActive ? '#fff' : SEVERITY_COLORS[sev];
    }
  }

  // Vuln list
  const listEl = document.createElement('div');
  listEl.setAttribute('data-part', 'vuln-list');
  listEl.setAttribute('role', 'list');
  listEl.setAttribute('aria-label', 'Vulnerabilities');
  root.appendChild(listEl);

  function getDisplayed(): Vulnerability[] {
    if (sig.get() === 'filtering' && activeFilter) {
      return sorted.filter((v) => v.severity === activeFilter);
    }
    return sorted;
  }

  function rebuildList() {
    listEl.innerHTML = '';
    const displayed = getDisplayed();
    if (displayed.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.setAttribute('data-part', 'empty');
      Object.assign(emptyDiv.style, { padding: '1rem', textAlign: 'center', color: '#9ca3af' });
      emptyDiv.textContent = sig.get() === 'filtering'
        ? 'No vulnerabilities match the selected severity.'
        : 'No vulnerabilities found.';
      listEl.appendChild(emptyDiv);
      return;
    }
    for (let idx = 0; idx < displayed.length; idx++) {
      const vuln = displayed[idx];
      const isExpanded = selectedId === vuln.id && sig.get() === 'vulnSelected';
      const item = document.createElement('div');
      item.setAttribute('data-part', 'vuln-item');
      item.setAttribute('data-severity', vuln.severity);
      item.setAttribute('data-vuln-id', vuln.id);
      item.setAttribute('data-expanded', isExpanded ? 'true' : 'false');
      item.setAttribute('role', 'listitem');
      item.setAttribute('aria-label', `${vuln.title} \u2014 ${vuln.severity}`);
      item.setAttribute('tabindex', '0');
      Object.assign(item.style, {
        border: '1px solid', borderColor: isExpanded ? SEVERITY_COLORS[vuln.severity] : '#e5e7eb',
        borderLeft: `4px solid ${SEVERITY_COLORS[vuln.severity]}`, borderRadius: '0.375rem',
        padding: '0.75rem', marginBottom: '0.5rem', cursor: 'pointer',
        backgroundColor: isExpanded ? SEVERITY_BG[vuln.severity] : 'transparent',
      });

      // Summary row
      const summaryRow = document.createElement('div');
      Object.assign(summaryRow.style, { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' });

      const sevBadge = document.createElement('span');
      sevBadge.setAttribute('data-part', 'vuln-severity');
      sevBadge.setAttribute('data-severity', vuln.severity);
      Object.assign(sevBadge.style, {
        display: 'inline-block', padding: '0.125rem 0.5rem', borderRadius: '9999px',
        fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.025em',
        color: '#fff', backgroundColor: SEVERITY_COLORS[vuln.severity],
      });
      sevBadge.textContent = vuln.severity;
      summaryRow.appendChild(sevBadge);

      const titleSpan = document.createElement('span');
      titleSpan.setAttribute('data-part', 'vuln-title');
      titleSpan.style.fontWeight = '600';
      titleSpan.style.flex = '1';
      titleSpan.textContent = vuln.title;
      summaryRow.appendChild(titleSpan);

      const pkgSpan = document.createElement('span');
      pkgSpan.setAttribute('data-part', 'vuln-package');
      Object.assign(pkgSpan.style, { fontSize: '0.8125rem', color: '#6b7280', fontFamily: 'monospace' });
      pkgSpan.textContent = `${vuln.package}@${vuln.installedVersion}`;
      summaryRow.appendChild(pkgSpan);

      item.appendChild(summaryRow);

      // Expanded detail
      if (isExpanded) {
        const detailEl = document.createElement('div');
        detailEl.setAttribute('data-part', 'vuln-detail');
        detailEl.style.marginTop = '0.75rem';

        const descP = document.createElement('p');
        Object.assign(descP.style, { margin: '0 0 0.5rem', fontSize: '0.875rem', lineHeight: '1.5' });
        descP.textContent = vuln.description;
        detailEl.appendChild(descP);

        if (showRemediation) {
          const remDiv = document.createElement('div');
          remDiv.setAttribute('data-part', 'remediation');
          remDiv.setAttribute('data-visible', 'true');
          remDiv.style.fontSize = '0.8125rem';
          if (vuln.patchedVersion) {
            remDiv.innerHTML = `<strong>Fix:</strong> Upgrade <code style="background-color:#f3f4f6;padding:0.1rem 0.25rem;border-radius:0.25rem">${vuln.package}</code> to <code style="background-color:#f3f4f6;padding:0.1rem 0.25rem;border-radius:0.25rem">${vuln.patchedVersion}</code>`;
          } else {
            const noPatch = document.createElement('span');
            noPatch.style.color = '#b91c1c';
            noPatch.textContent = 'No patch available';
            remDiv.appendChild(noPatch);
          }
          detailEl.appendChild(remDiv);
        }

        if (vuln.url) {
          const link = document.createElement('a');
          link.setAttribute('data-part', 'advisory-link');
          link.href = vuln.url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          Object.assign(link.style, { display: 'inline-block', marginTop: '0.5rem', fontSize: '0.8125rem', color: '#2563eb', textDecoration: 'underline' });
          link.textContent = 'View advisory';
          link.addEventListener('click', (e) => e.stopPropagation());
          detailEl.appendChild(link);
        }

        item.appendChild(detailEl);
      }

      item.addEventListener('click', () => {
        selectedId = selectedId === vuln.id ? null : vuln.id;
        if (selectedId) send('SELECT_VULN');
        else send('DESELECT');
        rebuildList();
      });
      item.addEventListener('focus', () => { focusIndex = idx; });

      listEl.appendChild(item);
    }
  }

  rebuildList();

  // Keyboard
  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const items = listEl.querySelectorAll<HTMLElement>('[data-part="vuln-item"]');
      focusIndex = Math.min(focusIndex + 1, items.length - 1);
      items[focusIndex]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const items = listEl.querySelectorAll<HTMLElement>('[data-part="vuln-item"]');
      focusIndex = Math.max(focusIndex - 1, 0);
      items[focusIndex]?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const items = listEl.querySelectorAll<HTMLElement>('[data-part="vuln-item"]');
      const id = items[focusIndex]?.getAttribute('data-vuln-id');
      if (id) {
        selectedId = selectedId === id ? null : id;
        if (selectedId) send('SELECT_VULN');
        else send('DESELECT');
        rebuildList();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (sig.get() === 'vulnSelected') { selectedId = null; send('DESELECT'); rebuildList(); }
      else if (sig.get() === 'filtering') { activeFilter = undefined; send('CLEAR'); rebuildList(); updateSevButtons(); }
    }
  });

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    headerEl.setAttribute('data-state', s);
    chartEl.setAttribute('data-state', s);
    summaryEl.setAttribute('data-state', s);
    listEl.setAttribute('data-state', s);
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default AuditReport;
