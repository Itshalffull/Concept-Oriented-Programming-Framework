// generated: fluxprovider.types.ts

export interface FluxProviderEmitInput {
  plan: string;
  repo: string;
  path: string;
}

export type FluxProviderEmitOutput =
  { variant: "ok"; kustomization: string; files: string[] };

export interface FluxProviderReconciliationStatusInput {
  kustomization: string;
}

export type FluxProviderReconciliationStatusOutput =
  { variant: "ok"; kustomization: string; readyStatus: string; appliedRevision: string; reconciledAt: Date }
  | { variant: "pending"; kustomization: string; waitingOn: string[] }
  | { variant: "failed"; kustomization: string; reason: string };

export interface FluxProviderHelmReleaseInput {
  kustomization: string;
  chart: string;
  values: string;
}

export type FluxProviderHelmReleaseOutput =
  { variant: "ok"; kustomization: string; releaseName: string }
  | { variant: "chartNotFound"; chart: string; sourceRef: string };

