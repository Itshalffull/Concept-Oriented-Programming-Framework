// generated: machineprovider.types.ts

export interface MachineProviderInitializeInput {
  config: Record<string, unknown>;
}

export type MachineProviderInitializeOutput =
  { variant: "ok"; provider: string; pluginRef: string }
  | { variant: "configError"; message: string };

export interface MachineProviderSpawnInput {
  machineId: string;
  definition: string;
  initialState: string;
  context?: Record<string, unknown>;
}

export type MachineProviderSpawnOutput =
  { variant: "ok"; machineId: string; state: string }
  | { variant: "duplicate"; message: string }
  | { variant: "invalid"; message: string };

export interface MachineProviderSendInput {
  machineId: string;
  event: string;
  payload?: Record<string, unknown>;
}

export type MachineProviderSendOutput =
  { variant: "ok"; machineId: string; previousState: string; currentState: string }
  | { variant: "notfound"; message: string }
  | { variant: "rejected"; message: string };

export interface MachineProviderConnectInput {
  sourceMachineId: string;
  targetMachineId: string;
  event: string;
}

export type MachineProviderConnectOutput =
  { variant: "ok"; connectionId: string }
  | { variant: "notfound"; message: string }
  | { variant: "duplicate"; message: string };

export interface MachineProviderDestroyInput {
  machineId: string;
}

export type MachineProviderDestroyOutput =
  { variant: "ok"; machineId: string }
  | { variant: "notfound"; message: string };
