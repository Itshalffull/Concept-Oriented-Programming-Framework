// generated: telemetry.types.ts

export interface TelemetryConfigureInput {
  concept: string;
  endpoint: string;
  samplingRate: number;
}

export type TelemetryConfigureOutput =
  { variant: "ok"; config: string };

export interface TelemetryDeployMarkerInput {
  kit: string;
  version: string;
  environment: string;
  status: string;
}

export type TelemetryDeployMarkerOutput =
  { variant: "ok"; marker: string }
  | { variant: "backendUnavailable"; endpoint: string };

export interface TelemetryAnalyzeInput {
  concept: string;
  window: number;
  criteria: string;
}

export type TelemetryAnalyzeOutput =
  { variant: "ok"; healthy: boolean; errorRate: number; latencyP99: number; sampleSize: number }
  | { variant: "insufficientData"; concept: string; samplesFound: number; samplesNeeded: number }
  | { variant: "backendUnavailable"; endpoint: string };

