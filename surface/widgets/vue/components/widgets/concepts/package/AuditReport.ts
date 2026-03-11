import { defineComponent, h, ref, computed, type PropType } from 'vue';

export type AuditReportState = 'idle' | 'filtering' | 'vulnSelected';
export type AuditReportEvent =
  | { type: 'FILTER'; severity?: string }
  | { type: 'SELECT_VULN'; id?: string }
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
      if (event.type === 'SELECT_VULN') return 'vulnSelected';
      return state;
    case 'vulnSelected':
      if (event.type === 'DESELECT') return 'idle';
      return state;
    default:
      return state;
  }
}

interface Vulnerability {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  packageName: string;
  packageVersion: string;
  description?: string;
  remediation?: string;
  cve?: string;
}

interface SeverityCount { severity: string; count: number; }

const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
const SEVERITY_COLORS: Record<string, string> = { critical: '#dc2626', high: '#ea580c', medium: '#ca8a04', low: '#2563eb' };

export const AuditReport = defineComponent({
  name: 'AuditReport',
  props: {
    vulnerabilities: { type: Array as PropType<Vulnerability[]>, required: true },
    severityCounts: { type: Array as PropType<SeverityCount[]>, required: true },
    lastScan: { type: String, required: true },
    status: { type: String, required: true },
    filterSeverity: { type: String, default: undefined },
    showRemediation: { type: Boolean, default: true },
  },
  emits: ['selectVuln', 'filter'],
  setup(props, { emit }) {
    const state = ref<AuditReportState>('idle');
    const activeSeverity = ref<string | undefined>(props.filterSeverity);
    const selectedId = ref<string | null>(null);
    const focusIndex = ref(0);

    function send(event: AuditReportEvent) {
      state.value = auditReportReducer(state.value, event);
    }

    const filtered = computed(() => {
      if (!activeSeverity.value) return props.vulnerabilities;
      return props.vulnerabilities.filter((v) => v.severity === activeSeverity.value);
    });

    const selectedVuln = computed(() => props.vulnerabilities.find((v) => v.id === selectedId.value));
    const totalCount = computed(() => props.severityCounts.reduce((sum, s) => sum + s.count, 0));

    function handleFilter(sev: string | undefined) {
      activeSeverity.value = sev;
      if (sev) { send({ type: 'FILTER', severity: sev }); emit('filter', sev); }
      else send({ type: 'CLEAR' });
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') { e.preventDefault(); focusIndex.value = Math.min(focusIndex.value + 1, filtered.value.length - 1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); focusIndex.value = Math.max(focusIndex.value - 1, 0); }
      if (e.key === 'Enter') { e.preventDefault(); const v = filtered.value[focusIndex.value]; if (v) { selectedId.value = v.id; send({ type: 'SELECT_VULN', id: v.id }); emit('selectVuln', v.id); } }
      if (e.key === 'Escape') { e.preventDefault(); selectedId.value = null; send({ type: 'DESELECT' }); }
    }

    return () => {
      const children: any[] = [];

      // Header
      children.push(h('div', { 'data-part': 'header' }, [
        h('span', { 'data-part': 'scan-status' }, props.status),
        h('span', { 'data-part': 'last-scan' }, `Last scan: ${props.lastScan}`),
      ]));

      // Severity chart
      children.push(h('div', { 'data-part': 'severity-chart', role: 'img', 'aria-label': 'Severity distribution' },
        SEVERITIES.map((sev) => {
          const sc = props.severityCounts.find((s) => s.severity === sev);
          const count = sc?.count ?? 0;
          const pct = totalCount.value > 0 ? (count / totalCount.value) * 100 : 0;
          return h('div', {
            key: sev, 'data-part': `${sev}-count`, 'data-severity': sev,
            style: { display: 'inline-block', width: `${pct}%`, minWidth: count > 0 ? '20px' : '0', backgroundColor: SEVERITY_COLORS[sev], textAlign: 'center', color: 'white' },
            onClick: () => handleFilter(activeSeverity.value === sev ? undefined : sev),
          }, count > 0 ? `${count}` : null);
        })));

      // Filter badges
      children.push(h('div', { 'data-part': 'filter-bar', role: 'toolbar' }, [
        h('button', { type: 'button', 'data-part': 'filter-all', 'data-active': !activeSeverity.value ? 'true' : 'false', 'aria-pressed': !activeSeverity.value, onClick: () => handleFilter(undefined) }, `All (${totalCount.value})`),
        ...SEVERITIES.map((sev) => {
          const count = props.severityCounts.find((s) => s.severity === sev)?.count ?? 0;
          return h('button', { type: 'button', 'data-part': 'filter-chip', 'data-severity': sev, 'data-active': activeSeverity.value === sev ? 'true' : 'false', 'aria-pressed': activeSeverity.value === sev, onClick: () => handleFilter(activeSeverity.value === sev ? undefined : sev) }, `${sev} (${count})`);
        }),
      ]));

      // Vulnerability list
      children.push(h('div', { 'data-part': 'vuln-list', role: 'list', 'aria-label': 'Vulnerabilities' },
        filtered.value.map((vuln, index) => {
          const isSelected = selectedId.value === vuln.id;
          return h('div', {
            key: vuln.id, 'data-part': 'vuln-item', role: 'listitem',
            'data-severity': vuln.severity, 'data-selected': isSelected ? 'true' : 'false',
            tabindex: focusIndex.value === index ? 0 : -1,
            onClick: () => { selectedId.value = vuln.id; send({ type: 'SELECT_VULN', id: vuln.id }); emit('selectVuln', vuln.id); },
          }, [
            h('div', { 'data-part': 'vuln-severity', 'data-severity': vuln.severity }, vuln.severity),
            h('span', { 'data-part': 'vuln-title' }, vuln.title),
            h('span', { 'data-part': 'vuln-package' }, `${vuln.packageName}@${vuln.packageVersion}`),
            vuln.cve ? h('span', { 'data-part': 'vuln-cve' }, vuln.cve) : null,
            props.showRemediation && vuln.remediation
              ? h('div', { 'data-part': 'vuln-remediation' }, vuln.remediation)
              : null,
          ]);
        }),
        filtered.value.length === 0
          ? [h('div', { 'data-part': 'empty-state' }, 'No vulnerabilities found')]
          : []
      ));

      return h('div', {
        role: 'region',
        'aria-label': 'Security audit report',
        'data-surface-widget': '',
        'data-widget-name': 'audit-report',
        'data-part': 'root',
        'data-state': state.value,
        tabindex: 0,
        onKeydown: handleKeydown,
      }, children);
    };
  },
});

export default AuditReport;
