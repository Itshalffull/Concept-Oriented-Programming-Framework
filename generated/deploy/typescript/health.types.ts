// generated: health.types.ts

export interface HealthCheckConceptInput {
  concept: string;
  runtime: string;
}

export type HealthCheckConceptOutput =
  { variant: "ok"; check: string; latencyMs: number }
  | { variant: "unreachable"; concept: string; transport: string }
  | { variant: "storageFailed"; concept: string; storage: string; reason: string }
  | { variant: "degraded"; concept: string; latencyMs: number; threshold: number };

export interface HealthCheckSyncInput {
  sync: string;
  concepts: string[];
}

export type HealthCheckSyncOutput =
  { variant: "ok"; check: string; roundTripMs: number }
  | { variant: "partialFailure"; sync: string; failed: string[] }
  | { variant: "timeout"; sync: string; timeoutMs: number };

export interface HealthCheckKitInput {
  kit: string;
  environment: string;
}

export type HealthCheckKitOutput =
  { variant: "ok"; check: string; conceptResults: string[]; syncResults: string[] }
  | { variant: "degraded"; check: string; healthy: string[]; degraded: string[] }
  | { variant: "failed"; check: string; healthy: string[]; failed: string[] };

export interface HealthCheckInvariantInput {
  concept: string;
  invariant: string;
}

export type HealthCheckInvariantOutput =
  { variant: "ok"; check: string }
  | { variant: "violated"; concept: string; invariant: string; expected: string; actual: string };

