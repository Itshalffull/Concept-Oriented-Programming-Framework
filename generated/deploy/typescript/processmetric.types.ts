// generated: processmetric.types.ts

export interface ProcessMetricRecordInput {
  metricName: string;
  metricValue: number;
  dimensions: string;
}

export type ProcessMetricRecordOutput =
  { variant: "ok"; metric: string };

export interface ProcessMetricQueryInput {
  metricName: string;
  from: string;
  to: string;
}

export type ProcessMetricQueryOutput =
  { variant: "ok"; metrics: string; count: number };

export interface ProcessMetricAggregateInput {
  metricName: string;
  aggregation: string;
  from: string;
  to: string;
}

export type ProcessMetricAggregateOutput =
  { variant: "ok"; value: number; sampleCount: number };
