/* ---------------------------------------------------------------------------
 * AuditReport — Vanilla widget
 *
 * Vulnerability audit report with severity distribution chart, filter by
 * severity, expandable vulnerability details, remediation display, and
 * keyboard navigation.
 * States: idle (initial), filtering, vulnSelected
 * ------------------------------------------------------------------------- */

export type Severity = 'critical' | 'high' | 'moderate' | 'low';

export type AuditReportState = 'idle' | 'filtering' | 'vulnSelected';
export type AuditReportEvent =
  | { type: 'FILTER'; severity?: Severity }
  | { type: 'SELECT_VULN'; id: string }
  | { type: 'CLEAR' }
  | { type: 'DESELECT' };

export function auditReportReducer(state: AuditReportState, event: AuditReportEvent): AuditReportState {
  switch (state) {
    case 'idle': if (event.type === 'FILTER') return 'filtering'; if (event.type === 'SELECT_VULN') return 'vulnSelected'; return state;
    case 'filtering': if (event.type === 'CLEAR') return 'idle'; return state;
    case 'vulnSelected': if (event.type === 'DESELECT') return 'idle'; return state;
    default: return state;
  }
}

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
const SEVERITY_COLORS: Record<Severity, string> = { critical: '#dc2626', high: '#ea580c', moderate: '#ca8a04', low: '#2563eb' };
const SEVERITY_BG: Record<Severity, string> = { critical: '#fef2f2', high: '#fff7ed', moderate: '#fefce8', low: '#eff6ff' };
const ALL_SEVERITIES: Severity[] = ['critical', 'high', 'moderate', 'low'];

function countBySeverity(vulns: Vulnerability[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, moderate: 0, low: 0 };
  for (const v of vulns) { if (v.severity in counts) counts[v.severity]++; }
  return counts;
}

export interface AuditReportProps {
  vulnerabilities: Vulnerability[];
  severityCounts?: Record<Severity, number>;
  lastScan: string;
  status: string;
  filterSeverity?: Severity | undefined;
  showRemediation?: boolean;
  className?: string;
  [key: string]: unknown;
}
export interface AuditReportOptions { target: HTMLElement; props: AuditReportProps; }

let _auditReportUid = 0;

export class AuditReport {
  private el: HTMLElement;
  private props: AuditReportProps;
  private state: AuditReportState = 'idle';
  private disposers: Array<() => void> = [];
  private selectedId: string | null = null;
  private activeFilter: Severity | undefined;
  private focusIdx = 0;
  private listEl: HTMLDivElement | null = null;

  constructor(options: AuditReportOptions) {
    this.props = { ...options.props };
    this.activeFilter = this.props.filterSeverity;
    if (this.activeFilter) this.state = 'filtering';
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'audit-report');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'region');
    this.el.setAttribute('aria-label', 'Security audit report');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'audit-report-' + (++_auditReportUid);

    const onKD = (e: KeyboardEvent) => this.onKey(e);
    this.el.addEventListener('keydown', onKD);
    this.disposers.push(() => this.el.removeEventListener('keydown', onKD));

    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  private send(ev: AuditReportEvent): void {
    this.state = auditReportReducer(this.state, ev);
    this.el.setAttribute('data-state', this.state);
  }

  update(props: Partial<AuditReportProps>): void {
    Object.assign(this.props, props);
    this.rerender();
  }

  destroy(): void { this.cleanup(); this.el.remove(); }
  private cleanup(): void { for (const d of this.disposers.splice(0)) d(); }
  private rerender(): void {
    // Keep the root keydown listener; cleanup only render-level listeners
    const rootKD = this.disposers.shift();
    this.cleanup();
    if (rootKD) this.disposers.push(rootKD);
    this.el.innerHTML = '';
    this.render();
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.focusItem(this.focusIdx + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.focusItem(this.focusIdx - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const items = this.listEl?.querySelectorAll<HTMLElement>('[data-part="vuln-item"]');
      const id = items?.[this.focusIdx]?.getAttribute('data-vuln-id');
      if (id) this.handleSelectVuln(id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (this.state === 'vulnSelected') {
        this.selectedId = null;
        this.send({ type: 'DESELECT' });
        this.rerender();
      } else if (this.state === 'filtering') {
        this.handleClearFilter();
      }
    }
  }

  private focusItem(index: number): void {
    const items = this.listEl?.querySelectorAll<HTMLElement>('[data-part="vuln-item"]');
    if (!items || items.length === 0) return;
    const clamped = Math.max(0, Math.min(index, items.length - 1));
    this.focusIdx = clamped;
    items[clamped]?.focus();
  }

  private handleFilter(sev: Severity): void {
    this.activeFilter = sev;
    this.focusIdx = 0;
    this.send({ type: 'FILTER', severity: sev });
    this.rerender();
  }

  private handleClearFilter(): void {
    this.activeFilter = undefined;
    this.focusIdx = 0;
    this.send({ type: 'CLEAR' });
    this.rerender();
  }

  private handleSelectVuln(id: string): void {
    this.selectedId = this.selectedId === id ? null : id;
    if (this.selectedId) {
      this.send({ type: 'SELECT_VULN', id });
    } else {
      this.send({ type: 'DESELECT' });
    }
    this.rerender();
  }

  private render(): void {
    const p = this.props;
    const vulns = p.vulnerabilities ?? [];
    const showRemediation = p.showRemediation !== false;
    const counts = p.severityCounts ?? countBySeverity(vulns);
    const total = Object.values(counts).reduce((s, n) => s + n, 0);

    // Sort by severity
    const sorted = [...vulns].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    // Apply filter
    const displayed = (this.state === 'filtering' && this.activeFilter)
      ? sorted.filter(v => v.severity === this.activeFilter)
      : sorted;

    this.el.setAttribute('data-state', this.state);
    this.el.setAttribute('data-status', p.status);
    if (p.className) this.el.className = p.className;

    // Header: scan status and timestamp
    const header = document.createElement('div');
    header.setAttribute('data-part', 'header');
    header.setAttribute('data-state', this.state);
    const statusEl = document.createElement('span');
    statusEl.setAttribute('data-part', 'status');
    statusEl.textContent = p.status;
    header.appendChild(statusEl);
    const lastScanEl = document.createElement('span');
    lastScanEl.setAttribute('data-part', 'last-scan');
    lastScanEl.textContent = `Last scan: ${p.lastScan}`;
    header.appendChild(lastScanEl);
    this.el.appendChild(header);

    // Severity distribution bar chart
    const chart = document.createElement('div');
    chart.setAttribute('data-part', 'severity-chart');
    chart.setAttribute('data-state', this.state);
    chart.setAttribute('role', 'img');
    chart.setAttribute('aria-label', 'Vulnerability severity distribution');
    chart.style.cssText = 'display:flex;height:8px;border-radius:4px;overflow:hidden;gap:0';
    for (const sev of ALL_SEVERITIES) {
      if (counts[sev] > 0) {
        const seg = document.createElement('div');
        seg.setAttribute('data-severity', sev);
        seg.style.cssText = `flex:${counts[sev] / (total || 1)};background-color:${SEVERITY_COLORS[sev]}`;
        seg.title = `${sev}: ${counts[sev]}`;
        chart.appendChild(seg);
      }
    }
    this.el.appendChild(chart);

    // Severity count badges
    const summary = document.createElement('div');
    summary.setAttribute('data-part', 'severity-summary');
    summary.setAttribute('data-state', this.state);
    summary.style.cssText = 'display:flex;gap:0.5rem;flex-wrap:wrap;margin:0.5rem 0';
    for (const sev of ALL_SEVERITIES) {
      const isActive = this.activeFilter === sev && this.state === 'filtering';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-part', sev);
      btn.setAttribute('data-state', this.state);
      btn.setAttribute('data-active', isActive ? 'true' : 'false');
      btn.setAttribute('aria-pressed', String(isActive));
      btn.setAttribute('aria-label', `${counts[sev]} ${sev}`);
      btn.style.cssText = `display:inline-flex;align-items:center;gap:0.25rem;padding:0.25rem 0.5rem;border:1px solid ${SEVERITY_COLORS[sev]};border-radius:9999px;background-color:${isActive ? SEVERITY_COLORS[sev] : SEVERITY_BG[sev]};color:${isActive ? '#fff' : SEVERITY_COLORS[sev]};font-weight:600;font-size:0.8125rem;cursor:pointer;line-height:1`;

      const countSpan = document.createElement('span');
      countSpan.textContent = String(counts[sev]);
      btn.appendChild(countSpan);
      const nameSpan = document.createElement('span');
      nameSpan.textContent = sev;
      btn.appendChild(nameSpan);

      const onFilterClick = () => {
        if (isActive) { this.handleClearFilter(); }
        else { this.handleFilter(sev); }
      };
      btn.addEventListener('click', onFilterClick);
      this.disposers.push(() => btn.removeEventListener('click', onFilterClick));
      summary.appendChild(btn);
    }
    this.el.appendChild(summary);

    // Vulnerability list
    const listEl = document.createElement('div');
    listEl.setAttribute('data-part', 'vuln-list');
    listEl.setAttribute('data-state', this.state);
    listEl.setAttribute('role', 'list');
    listEl.setAttribute('aria-label', 'Vulnerabilities');
    this.listEl = listEl;

    displayed.forEach((vuln, idx) => {
      const isExpanded = this.selectedId === vuln.id && this.state === 'vulnSelected';
      const item = document.createElement('div');
      item.setAttribute('data-part', 'vuln-item');
      item.setAttribute('data-state', this.state);
      item.setAttribute('data-severity', vuln.severity);
      item.setAttribute('data-vuln-id', vuln.id);
      item.setAttribute('data-expanded', isExpanded ? 'true' : 'false');
      item.setAttribute('role', 'listitem');
      item.setAttribute('aria-label', `${vuln.title} \u2014 ${vuln.severity}`);
      item.tabIndex = 0;
      item.style.cssText = `border:1px solid ${isExpanded ? SEVERITY_COLORS[vuln.severity] : '#e5e7eb'};border-left:4px solid ${SEVERITY_COLORS[vuln.severity]};border-radius:0.375rem;padding:0.75rem;margin-bottom:0.5rem;cursor:pointer;background-color:${isExpanded ? SEVERITY_BG[vuln.severity] : 'transparent'}`;

      // Summary row
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap';

      const sevBadge = document.createElement('span');
      sevBadge.setAttribute('data-part', 'vuln-severity');
      sevBadge.setAttribute('data-severity', vuln.severity);
      sevBadge.setAttribute('data-state', this.state);
      sevBadge.style.cssText = `display:inline-block;padding:0.125rem 0.5rem;border-radius:9999px;font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.025em;color:#fff;background-color:${SEVERITY_COLORS[vuln.severity]}`;
      sevBadge.textContent = vuln.severity;
      row.appendChild(sevBadge);

      const titleEl = document.createElement('span');
      titleEl.setAttribute('data-part', 'vuln-title');
      titleEl.setAttribute('data-state', this.state);
      titleEl.style.cssText = 'font-weight:600;flex:1';
      titleEl.textContent = vuln.title;
      row.appendChild(titleEl);

      const pkgEl = document.createElement('span');
      pkgEl.setAttribute('data-part', 'vuln-package');
      pkgEl.setAttribute('data-state', this.state);
      pkgEl.style.cssText = 'font-size:0.8125rem;color:#6b7280;font-family:monospace';
      pkgEl.textContent = `${vuln.package}@${vuln.installedVersion}`;
      row.appendChild(pkgEl);

      item.appendChild(row);

      // Expanded detail
      if (isExpanded) {
        const detail = document.createElement('div');
        detail.setAttribute('data-part', 'vuln-detail');
        detail.setAttribute('data-state', this.state);
        detail.style.cssText = 'margin-top:0.75rem';

        const descP = document.createElement('p');
        descP.style.cssText = 'margin:0 0 0.5rem;font-size:0.875rem;line-height:1.5';
        descP.textContent = vuln.description;
        detail.appendChild(descP);

        if (showRemediation) {
          const rem = document.createElement('div');
          rem.setAttribute('data-part', 'remediation');
          rem.setAttribute('data-state', this.state);
          rem.setAttribute('data-visible', 'true');
          rem.style.cssText = 'font-size:0.8125rem';
          if (vuln.patchedVersion) {
            rem.innerHTML = `<span><strong>Fix:</strong> Upgrade <code style="background-color:#f3f4f6;padding:0.1rem 0.25rem;border-radius:0.25rem">${vuln.package}</code> to <code style="background-color:#f3f4f6;padding:0.1rem 0.25rem;border-radius:0.25rem">${vuln.patchedVersion}</code></span>`;
          } else {
            const noFix = document.createElement('span');
            noFix.style.color = '#b91c1c';
            noFix.textContent = 'No patch available';
            rem.appendChild(noFix);
          }
          detail.appendChild(rem);
        }

        if (vuln.url) {
          const link = document.createElement('a');
          link.setAttribute('data-part', 'advisory-link');
          link.href = vuln.url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.style.cssText = 'display:inline-block;margin-top:0.5rem;font-size:0.8125rem;color:#2563eb;text-decoration:underline';
          link.textContent = 'View advisory';
          link.addEventListener('click', (e) => e.stopPropagation());
          detail.appendChild(link);
        }

        item.appendChild(detail);
      }

      const onItemClick = () => this.handleSelectVuln(vuln.id);
      item.addEventListener('click', onItemClick);
      item.addEventListener('focus', () => { this.focusIdx = idx; });
      this.disposers.push(() => item.removeEventListener('click', onItemClick));
      listEl.appendChild(item);
    });

    // Empty state
    if (displayed.length === 0) {
      const empty = document.createElement('div');
      empty.setAttribute('data-part', 'empty');
      empty.setAttribute('data-state', this.state);
      empty.style.cssText = 'padding:1rem;text-align:center;color:#9ca3af';
      empty.textContent = this.state === 'filtering'
        ? 'No vulnerabilities match the selected severity.'
        : 'No vulnerabilities found.';
      listEl.appendChild(empty);
    }

    this.el.appendChild(listEl);
  }
}

export default AuditReport;
