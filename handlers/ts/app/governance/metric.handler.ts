// Metric Concept Handler
// KPI tracking with threshold detection.
import type { ConceptHandler } from '@clef/runtime';

export const metricHandler: ConceptHandler = {
  async define(input, storage) {
    const id = `metric-${Date.now()}`;
    await storage.put('metric', id, {
      id, name: input.name, unit: input.unit,
      aggregation: input.aggregation, value: null, history: [],
    });
    return { variant: 'defined', metric: id };
  },

  async update(input, storage) {
    const { metric, value, source } = input;
    const record = await storage.get('metric', metric as string);
    if (!record) return { variant: 'not_found', metric };
    const history = record.history as unknown[];
    const previousValue = record.value;
    history.push({ value, source, recordedAt: new Date().toISOString() });
    await storage.put('metric', metric as string, { ...record, value, history, updatedAt: new Date().toISOString() });
    // Check threshold if set
    if (record.threshold !== undefined) {
      const threshold = record.threshold as number;
      const direction = (value as number) > threshold ? 'breached' : 'recovered';
      if ((previousValue as number) <= threshold && (value as number) > threshold) {
        return { variant: 'threshold_crossed', metric, threshold, direction };
      }
    }
    return { variant: 'updated', metric, previousValue };
  },

  async setThreshold(input, storage) {
    const { metric, threshold, alertOnBreach } = input;
    const record = await storage.get('metric', metric as string);
    if (!record) return { variant: 'not_found', metric };
    await storage.put('metric', metric as string, { ...record, threshold, alertOnBreach });
    return { variant: 'threshold_set', metric };
  },

  async evaluate(input, storage) {
    const { metric } = input;
    const record = await storage.get('metric', metric as string);
    if (!record) return { variant: 'not_found', metric };
    const withinThreshold = record.threshold == null || (record.value as number) <= (record.threshold as number);
    return withinThreshold
      ? { variant: 'within_threshold', metric, value: record.value }
      : { variant: 'threshold_crossed', metric, threshold: record.threshold, direction: 'breached' };
  },
};
