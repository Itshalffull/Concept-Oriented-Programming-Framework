import {
  StackLayout,
  Label,
  Button,
  ScrollView,
} from '@nativescript/core';

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
  filterSeverity?: Severity;
  showRemediation?: boolean;
}

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, moderate: 2, low: 3 };
const SEVERITY_COLORS: Record<Severity, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  moderate: '#ca8a04',
  low: '#2563eb',
};
const ALL_SEVERITIES: Severity[] = ['critical', 'high', 'moderate', 'low'];

function countBySeverity(vulns: Vulnerability[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, moderate: 0, low: 0 };
  for (const v of vulns) {
    if (v.severity in counts) counts[v.severity]++;
  }
  return counts;
}

export function createAuditReport(props: AuditReportProps): {
  view: StackLayout;
  dispose: () => void;
} {
  let state: AuditReportState = props.filterSeverity ? 'filtering' : 'idle';
  let activeFilter: Severity | undefined = props.filterSeverity;
  let selectedId: string | null = null;
  const disposers: (() => void)[] = [];

  function send(event: AuditReportEvent) {
    state = auditReportReducer(state, event);
    update();
  }

  const root = new StackLayout();
  root.className = 'audit-report';
  root.automationText = 'Security audit report';

  const header = new StackLayout();
  header.orientation = 'horizontal';
  const statusLbl = new Label();
  statusLbl.text = props.status;
  statusLbl.fontWeight = 'bold';
  header.addChild(statusLbl);
  const scanLbl = new Label();
  scanLbl.text = `Last scan: ${props.lastScan}`;
  scanLbl.marginLeft = 12;
  header.addChild(scanLbl);
  root.addChild(header);

  const distBar = new StackLayout();
  distBar.orientation = 'horizontal';
  distBar.height = 8;
  root.addChild(distBar);

  const filterRow = new StackLayout();
  filterRow.orientation = 'horizontal';
  filterRow.marginTop = 8;
  filterRow.marginBottom = 8;
  root.addChild(filterRow);

  const vulnScroll = new ScrollView();
  const vulnList = new StackLayout();
  vulnScroll.content = vulnList;
  root.addChild(vulnScroll);

  function update() {
    const counts = props.severityCounts ?? countBySeverity(props.vulnerabilities);
    const total = Object.values(counts).reduce((s, n) => s + n, 0);

    distBar.removeChildren();
    for (const sev of ALL_SEVERITIES) {
      if (counts[sev] > 0) {
        const seg = new StackLayout();
        seg.backgroundColor = SEVERITY_COLORS[sev];
        seg.height = 8;
        distBar.addChild(seg);
      }
    }

    filterRow.removeChildren();
    for (const sev of ALL_SEVERITIES) {
      const btn = new Button();
      btn.text = `${counts[sev]} ${sev}`;
      btn.className = activeFilter === sev && state === 'filtering' ? 'severity-active' : 'severity-btn';
      btn.on('tap', () => {
        if (activeFilter === sev && state === 'filtering') {
          activeFilter = undefined;
          send({ type: 'CLEAR' });
        } else {
          activeFilter = sev;
          send({ type: 'FILTER', severity: sev });
        }
      });
      filterRow.addChild(btn);
    }

    const sorted = [...props.vulnerabilities].sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
    );
    const displayed =
      state === 'filtering' && activeFilter
        ? sorted.filter((v) => v.severity === activeFilter)
        : sorted;

    vulnList.removeChildren();
    if (displayed.length === 0) {
      const empty = new Label();
      empty.text =
        state === 'filtering'
          ? 'No vulnerabilities match the selected severity.'
          : 'No vulnerabilities found.';
      empty.textAlignment = 'center';
      empty.padding = 16;
      vulnList.addChild(empty);
      return;
    }

    for (const vuln of displayed) {
      const isExpanded = selectedId === vuln.id && state === 'vulnSelected';
      const item = new StackLayout();
      item.borderWidth = 1;
      item.borderColor = isExpanded ? SEVERITY_COLORS[vuln.severity] : '#e5e7eb';
      item.borderLeftWidth = 4;
      item.borderLeftColor = SEVERITY_COLORS[vuln.severity];
      item.borderRadius = 6;
      item.padding = 12;
      item.marginBottom = 8;

      const summaryRow = new StackLayout();
      summaryRow.orientation = 'horizontal';

      const sevBadge = new Label();
      sevBadge.text = vuln.severity.toUpperCase();
      sevBadge.color = '#ffffff' as any;
      sevBadge.backgroundColor = SEVERITY_COLORS[vuln.severity];
      sevBadge.padding = '2 8';
      sevBadge.borderRadius = 9999;
      sevBadge.fontSize = 12;
      sevBadge.fontWeight = 'bold';
      summaryRow.addChild(sevBadge);

      const titleLbl = new Label();
      titleLbl.text = vuln.title;
      titleLbl.fontWeight = 'bold';
      titleLbl.marginLeft = 8;
      summaryRow.addChild(titleLbl);

      const pkgLbl = new Label();
      pkgLbl.text = `${vuln.package}@${vuln.installedVersion}`;
      pkgLbl.fontSize = 13;
      pkgLbl.marginLeft = 8;
      pkgLbl.fontFamily = 'monospace';
      summaryRow.addChild(pkgLbl);

      item.addChild(summaryRow);

      if (isExpanded) {
        const descLbl = new Label();
        descLbl.text = vuln.description;
        descLbl.textWrap = true;
        descLbl.marginTop = 8;
        item.addChild(descLbl);

        if (props.showRemediation !== false) {
          const remLbl = new Label();
          if (vuln.patchedVersion) {
            remLbl.text = `Fix: Upgrade ${vuln.package} to ${vuln.patchedVersion}`;
          } else {
            remLbl.text = 'No patch available';
            remLbl.color = '#b91c1c' as any;
          }
          remLbl.fontSize = 13;
          remLbl.marginTop = 4;
          item.addChild(remLbl);
        }

        if (vuln.url) {
          const linkLbl = new Label();
          linkLbl.text = 'View advisory';
          linkLbl.color = '#2563eb' as any;
          linkLbl.fontSize = 13;
          linkLbl.marginTop = 4;
          item.addChild(linkLbl);
        }
      }

      item.on('tap', () => {
        if (selectedId === vuln.id) {
          selectedId = null;
          send({ type: 'DESELECT' });
        } else {
          selectedId = vuln.id;
          send({ type: 'SELECT_VULN', id: vuln.id });
        }
      });

      vulnList.addChild(item);
    }
  }

  update();

  return {
    view: root,
    dispose() {
      disposers.forEach((d) => d());
    },
  };
}

export default createAuditReport;
