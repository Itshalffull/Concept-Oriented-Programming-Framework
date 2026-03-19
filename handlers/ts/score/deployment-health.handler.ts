// DeploymentHealth Concept Implementation
//
// Live deployment monitoring — runtime health, transport connectivity,
// storage adapter status, sync delivery rates, concept instance counts,
// and cross-runtime latency. Connects live operational data to the
// static deployment topology and concept structure for operational
// insight queries.

import type { ConceptHandler, ConceptStorage } from '@clef/runtime';

export const deploymentHealthHandler: ConceptHandler = {

  async record(input, storage) {
    const deployment = input.deployment as string;
    const snapshot = input.snapshot as string;

    const id = crypto.randomUUID();
    const parsed = snapshot ? JSON.parse(snapshot) : {};
    const timestamp = new Date().toISOString();

    await storage.put('deployment-health', `health:${deployment}:${id}`, {
      id,
      deployment,
      timestamp,
      runtimeStatuses: JSON.stringify(parsed.runtimeStatuses || []),
      transportStatuses: JSON.stringify(parsed.transportStatuses || []),
      storageStatuses: JSON.stringify(parsed.storageStatuses || []),
      syncDeliveryRates: JSON.stringify(parsed.syncDeliveryRates || []),
      conceptInstanceCounts: JSON.stringify(parsed.conceptInstanceCounts || []),
      crossRuntimeLatency: JSON.stringify(parsed.crossRuntimeLatency || []),
      alerts: JSON.stringify(parsed.alerts || []),
    });

    return { variant: 'ok', check: id };
  },

  async runtimeHealth(input, storage) {
    const deployment = input.deployment as string;

    const all = await storage.find('deployment-health', { deployment });
    if (all.length === 0) {
      return { variant: 'ok', runtimes: '[]' };
    }

    // Return the most recent snapshot
    const latest = all.sort((a, b) =>
      (b.timestamp as string).localeCompare(a.timestamp as string)
    )[0];

    return { variant: 'ok', runtimes: latest.runtimeStatuses as string || '[]' };
  },

  async transportHealth(input, storage) {
    const deployment = input.deployment as string;

    const all = await storage.find('deployment-health', { deployment });
    if (all.length === 0) {
      return { variant: 'ok', transports: '[]' };
    }

    const latest = all.sort((a, b) =>
      (b.timestamp as string).localeCompare(a.timestamp as string)
    )[0];

    return { variant: 'ok', transports: latest.transportStatuses as string || '[]' };
  },

  async storageHealth(input, storage) {
    const deployment = input.deployment as string;

    const all = await storage.find('deployment-health', { deployment });
    if (all.length === 0) {
      return { variant: 'ok', adapters: '[]' };
    }

    const latest = all.sort((a, b) =>
      (b.timestamp as string).localeCompare(a.timestamp as string)
    )[0];

    return { variant: 'ok', adapters: latest.storageStatuses as string || '[]' };
  },

  async syncDelivery(input, storage) {
    const deployment = input.deployment as string;
    const since = input.since as string;

    const all = await storage.find('deployment-health', { deployment });
    const filtered = since
      ? all.filter(h => (h.timestamp as string) >= since)
      : all;

    if (filtered.length === 0) {
      return { variant: 'ok', syncs: '[]' };
    }

    const latest = filtered.sort((a, b) =>
      (b.timestamp as string).localeCompare(a.timestamp as string)
    )[0];

    return { variant: 'ok', syncs: latest.syncDeliveryRates as string || '[]' };
  },

  async conceptInstances(input, storage) {
    const deployment = input.deployment as string;

    const all = await storage.find('deployment-health', { deployment });
    if (all.length === 0) {
      return { variant: 'ok', instances: '[]' };
    }

    const latest = all.sort((a, b) =>
      (b.timestamp as string).localeCompare(a.timestamp as string)
    )[0];

    return { variant: 'ok', instances: latest.conceptInstanceCounts as string || '[]' };
  },

  async crossRuntimeLatency(input, storage) {
    const deployment = input.deployment as string;

    const all = await storage.find('deployment-health', { deployment });
    if (all.length === 0) {
      return { variant: 'ok', matrix: '[]' };
    }

    const latest = all.sort((a, b) =>
      (b.timestamp as string).localeCompare(a.timestamp as string)
    )[0];

    return { variant: 'ok', matrix: latest.crossRuntimeLatency as string || '[]' };
  },

  async hotspots(input, storage) {
    const deployment = input.deployment as string;
    const since = input.since as string;
    const topN = (input.topN as number) || 10;

    const all = await storage.find('deployment-health', { deployment });
    const filtered = since
      ? all.filter(h => (h.timestamp as string) >= since)
      : all;

    if (filtered.length === 0) {
      return { variant: 'ok', hotspots: '[]' };
    }

    // Aggregate metrics across snapshots — count alert occurrences,
    // error statuses, and high-latency entries per runtime/transport.
    const counts = new Map<string, { entity: string; kind: string; errorCount: number; alertCount: number; lastSeen: string }>();

    for (const snapshot of filtered) {
      const ts = snapshot.timestamp as string;
      const runtimes: Array<{ name?: string; status?: string }> = JSON.parse(snapshot.runtimeStatuses as string || '[]');
      for (const rt of runtimes) {
        const key = `runtime:${rt.name || 'unknown'}`;
        const existing = counts.get(key) || { entity: rt.name || 'unknown', kind: 'runtime', errorCount: 0, alertCount: 0, lastSeen: '' };
        if (rt.status === 'unhealthy' || rt.status === 'unreachable' || rt.status === 'failed' || rt.status === 'buildFailed') {
          existing.errorCount++;
        }
        if (ts > existing.lastSeen) existing.lastSeen = ts;
        counts.set(key, existing);
      }

      const transports: Array<{ name?: string; errorRate?: number }> = JSON.parse(snapshot.transportStatuses as string || '[]');
      for (const tr of transports) {
        const key = `transport:${tr.name || 'unknown'}`;
        const existing = counts.get(key) || { entity: tr.name || 'unknown', kind: 'transport', errorCount: 0, alertCount: 0, lastSeen: '' };
        if ((tr.errorRate || 0) > 0.01) existing.errorCount++;
        if (ts > existing.lastSeen) existing.lastSeen = ts;
        counts.set(key, existing);
      }

      const alerts: unknown[] = JSON.parse(snapshot.alerts as string || '[]');
      for (const alert of alerts) {
        const alertStr = typeof alert === 'string' ? alert : (alert as Record<string, unknown>).entity as string || 'unknown';
        const key = `alert:${alertStr}`;
        const existing = counts.get(key) || { entity: alertStr, kind: 'alert', errorCount: 0, alertCount: 0, lastSeen: '' };
        existing.alertCount++;
        if (ts > existing.lastSeen) existing.lastSeen = ts;
        counts.set(key, existing);
      }
    }

    const hotspots = [...counts.values()]
      .filter(h => h.errorCount > 0 || h.alertCount > 0)
      .sort((a, b) => (b.errorCount + b.alertCount) - (a.errorCount + a.alertCount))
      .slice(0, topN);

    return { variant: 'ok', hotspots: JSON.stringify(hotspots) };
  },

  async correlateWithErrors(input, storage) {
    const deployment = input.deployment as string;
    const since = input.since as string;

    // Query error-correlation records that reference this deployment
    const allErrors = await storage.find('error-correlation');
    const matching = allErrors.filter(e => {
      const matchesDeploy =
        (e.conceptEntity as string || '').includes(deployment) ||
        (e.flowId as string || '') === deployment ||
        (e.errorMessage as string || '').includes(deployment);
      if (!matchesDeploy) return false;
      if (since) return (e.timestamp as string) >= since;
      return true;
    });

    // Group by entity and count
    const grouped = new Map<string, { entity: string; count: number; lastMessage: string; lastSeen: string }>();
    for (const err of matching) {
      const entity = (err.actionEntity as string) || (err.conceptEntity as string) || (err.syncEntity as string) || 'unknown';
      const existing = grouped.get(entity) || { entity, count: 0, lastMessage: '', lastSeen: '' };
      existing.count++;
      const ts = err.timestamp as string;
      if (ts > existing.lastSeen) {
        existing.lastSeen = ts;
        existing.lastMessage = err.errorMessage as string || '';
      }
      grouped.set(entity, existing);
    }

    const correlations = [...grouped.values()].sort((a, b) => b.count - a.count);
    return { variant: 'ok', correlations: JSON.stringify(correlations) };
  },

  async compareWindows(input, storage) {
    const deployment = input.deployment as string;
    const windowA = input.windowA as string;
    const windowB = input.windowB as string;

    const all = await storage.find('deployment-health', { deployment });

    // Split snapshots into the two time windows (ISO timestamp ranges: "start/end")
    const [aStart, aEnd] = windowA.split('/');
    const [bStart, bEnd] = windowB.split('/');

    const inA = all.filter(h => {
      const ts = h.timestamp as string;
      return ts >= aStart && ts <= (aEnd || '9999');
    });
    const inB = all.filter(h => {
      const ts = h.timestamp as string;
      return ts >= bStart && ts <= (bEnd || '9999');
    });

    function avgErrorRate(snapshots: Record<string, unknown>[]): number {
      if (snapshots.length === 0) return 0;
      let errors = 0;
      let total = 0;
      for (const s of snapshots) {
        const runtimes: Array<{ status?: string }> = JSON.parse(s.runtimeStatuses as string || '[]');
        for (const rt of runtimes) {
          total++;
          if (rt.status === 'unhealthy' || rt.status === 'unreachable' || rt.status === 'failed') errors++;
        }
      }
      return total > 0 ? errors / total : 0;
    }

    function avgAlertCount(snapshots: Record<string, unknown>[]): number {
      if (snapshots.length === 0) return 0;
      let total = 0;
      for (const s of snapshots) {
        const alerts: unknown[] = JSON.parse(s.alerts as string || '[]');
        total += alerts.length;
      }
      return total / snapshots.length;
    }

    const errorRateA = avgErrorRate(inA);
    const errorRateB = avgErrorRate(inB);
    const alertRateA = avgAlertCount(inA);
    const alertRateB = avgAlertCount(inB);

    const regressions: string[] = [];
    if (errorRateB > errorRateA && errorRateB > 0) {
      regressions.push(`Error rate increased from ${(errorRateA * 100).toFixed(1)}% to ${(errorRateB * 100).toFixed(1)}%`);
    }
    if (alertRateB > alertRateA * 1.5 && alertRateB > 0) {
      regressions.push(`Alert rate increased from ${alertRateA.toFixed(1)} to ${alertRateB.toFixed(1)} per snapshot`);
    }

    const comparison = {
      windowA: { snapshots: inA.length, errorRate: errorRateA, avgAlerts: alertRateA },
      windowB: { snapshots: inB.length, errorRate: errorRateB, avgAlerts: alertRateB },
      regressions,
    };

    return { variant: 'ok', comparison: JSON.stringify(comparison) };
  },

  async deployDiagnostics(input, storage) {
    const deployment = input.deployment as string;

    // Collect all health records for this deployment
    const all = await storage.find('deployment-health', { deployment });
    if (all.length === 0) {
      return { variant: 'ok', diagnostics: '[]', summary: 'No deployment records found.' };
    }

    // Build diagnostics from snapshots
    const diagnostics = all.map(record => ({
      id: record.id as string,
      timestamp: record.timestamp as string,
      runtimes: JSON.parse(record.runtimeStatuses as string || '[]'),
      alerts: JSON.parse(record.alerts as string || '[]'),
    }));

    // Aggregate: count failures, successes, alerts
    let failures = 0;
    let successes = 0;
    const allAlerts: string[] = [];
    for (const d of diagnostics) {
      for (const rt of d.runtimes) {
        if (rt.status === 'failed' || rt.status === 'buildFailed') failures++;
        else if (rt.status === 'deployed' || rt.status === 'ok') successes++;
      }
      for (const alert of d.alerts) {
        allAlerts.push(typeof alert === 'string' ? alert : JSON.stringify(alert));
      }
    }

    const summary = `${successes} successful, ${failures} failed, ${allAlerts.length} alerts across ${all.length} records.`;

    return {
      variant: 'ok',
      diagnostics: JSON.stringify(diagnostics),
      summary,
      failures,
      successes,
      alerts: JSON.stringify(allAlerts),
    };
  },

  async sloStatus(input, storage) {
    const deployment = input.deployment as string;

    const all = await storage.find('deployment-health', { deployment });
    if (all.length === 0) {
      return { variant: 'ok', slos: '[]' };
    }

    // Compute SLO compliance from health snapshots.
    // Default SLOs: 99.9% availability, <200ms p99 latency, <1% error rate.
    let totalRuntimeChecks = 0;
    let healthyChecks = 0;
    let totalLatencyMs = 0;
    let latencyCount = 0;
    let totalSyncDeliveries = 0;
    let failedSyncDeliveries = 0;

    for (const snapshot of all) {
      const runtimes: Array<{ status?: string; latencyMs?: number }> = JSON.parse(snapshot.runtimeStatuses as string || '[]');
      for (const rt of runtimes) {
        totalRuntimeChecks++;
        if (rt.status === 'healthy' || rt.status === 'ok' || rt.status === 'deployed') healthyChecks++;
        if (rt.latencyMs != null) {
          totalLatencyMs += rt.latencyMs;
          latencyCount++;
        }
      }

      const syncs: Array<{ delivered?: number; failed?: number }> = JSON.parse(snapshot.syncDeliveryRates as string || '[]');
      for (const s of syncs) {
        totalSyncDeliveries += (s.delivered || 0) + (s.failed || 0);
        failedSyncDeliveries += s.failed || 0;
      }
    }

    const availability = totalRuntimeChecks > 0 ? healthyChecks / totalRuntimeChecks : 1;
    const avgLatencyMs = latencyCount > 0 ? totalLatencyMs / latencyCount : 0;
    const syncErrorRate = totalSyncDeliveries > 0 ? failedSyncDeliveries / totalSyncDeliveries : 0;

    const slos = [
      {
        name: 'availability',
        target: 0.999,
        actual: availability,
        compliant: availability >= 0.999,
        window: `${all.length} snapshots`,
      },
      {
        name: 'latency-p99',
        target: 200,
        actual: avgLatencyMs,
        compliant: avgLatencyMs <= 200,
        window: `${latencyCount} measurements`,
      },
      {
        name: 'sync-error-rate',
        target: 0.01,
        actual: syncErrorRate,
        compliant: syncErrorRate <= 0.01,
        window: `${totalSyncDeliveries} deliveries`,
      },
    ];

    return { variant: 'ok', slos: JSON.stringify(slos) };
  },
};
