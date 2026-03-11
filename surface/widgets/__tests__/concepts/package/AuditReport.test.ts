import { describe, it, expect } from 'vitest';
import {
  auditReportReducer,
  type AuditReportState,
} from '../../../vanilla/components/widgets/concepts/package/AuditReport.ts';

describe('AuditReport reducer', () => {
  describe('idle state', () => {
    const state: AuditReportState = 'idle';

    it('transitions to filtering on FILTER', () => {
      expect(auditReportReducer(state, { type: 'FILTER' })).toBe('filtering');
    });

    it('transitions to vulnSelected on SELECT_VULN', () => {
      expect(auditReportReducer(state, { type: 'SELECT_VULN', id: 'v1' })).toBe('vulnSelected');
    });

    it('ignores CLEAR', () => {
      expect(auditReportReducer(state, { type: 'CLEAR' })).toBe('idle');
    });

    it('ignores DESELECT', () => {
      expect(auditReportReducer(state, { type: 'DESELECT' })).toBe('idle');
    });
  });

  describe('filtering state', () => {
    const state: AuditReportState = 'filtering';

    it('transitions to idle on CLEAR', () => {
      expect(auditReportReducer(state, { type: 'CLEAR' })).toBe('idle');
    });

    it('ignores FILTER', () => {
      expect(auditReportReducer(state, { type: 'FILTER' })).toBe('filtering');
    });

    it('ignores SELECT_VULN', () => {
      expect(auditReportReducer(state, { type: 'SELECT_VULN', id: 'v1' })).toBe('filtering');
    });

    it('ignores DESELECT', () => {
      expect(auditReportReducer(state, { type: 'DESELECT' })).toBe('filtering');
    });
  });

  describe('vulnSelected state', () => {
    const state: AuditReportState = 'vulnSelected';

    it('transitions to idle on DESELECT', () => {
      expect(auditReportReducer(state, { type: 'DESELECT' })).toBe('idle');
    });

    it('ignores FILTER', () => {
      expect(auditReportReducer(state, { type: 'FILTER' })).toBe('vulnSelected');
    });

    it('ignores CLEAR', () => {
      expect(auditReportReducer(state, { type: 'CLEAR' })).toBe('vulnSelected');
    });

    it('ignores SELECT_VULN', () => {
      expect(auditReportReducer(state, { type: 'SELECT_VULN', id: 'v2' })).toBe('vulnSelected');
    });
  });

  describe('full cycle tests', () => {
    it('idle -> filtering -> idle', () => {
      let s: AuditReportState = 'idle';
      s = auditReportReducer(s, { type: 'FILTER', severity: 'critical' });
      expect(s).toBe('filtering');
      s = auditReportReducer(s, { type: 'CLEAR' });
      expect(s).toBe('idle');
    });

    it('idle -> vulnSelected -> idle -> filtering -> idle', () => {
      let s: AuditReportState = 'idle';
      s = auditReportReducer(s, { type: 'SELECT_VULN', id: 'v1' });
      expect(s).toBe('vulnSelected');
      s = auditReportReducer(s, { type: 'DESELECT' });
      expect(s).toBe('idle');
      s = auditReportReducer(s, { type: 'FILTER' });
      expect(s).toBe('filtering');
      s = auditReportReducer(s, { type: 'CLEAR' });
      expect(s).toBe('idle');
    });
  });
});
