// generated: argocdprovider.types.ts

export interface ArgoCDProviderEmitInput {
  plan: string;
  repo: string;
  path: string;
}

export type ArgoCDProviderEmitOutput =
  { variant: "ok"; application: string; files: string[] };

export interface ArgoCDProviderReconciliationStatusInput {
  application: string;
}

export type ArgoCDProviderReconciliationStatusOutput =
  { variant: "ok"; application: string; syncStatus: string; healthStatus: string; reconciledAt: Date }
  | { variant: "pending"; application: string; waitingOn: string[] }
  | { variant: "degraded"; application: string; unhealthyResources: string[] }
  | { variant: "failed"; application: string; reason: string };

export interface ArgoCDProviderSyncWaveInput {
  application: string;
  wave: number;
}

export type ArgoCDProviderSyncWaveOutput =
  { variant: "ok"; application: string };

