// generated: machine.types.ts

export interface MachineSpawnInput {
  machine: string;
  component: string;
  context: string;
}

export type MachineSpawnOutput =
  { variant: "ok"; machine: string }
  | { variant: "notfound"; message: string };

export interface MachineSendInput {
  machine: string;
  event: string;
}

export type MachineSendOutput =
  { variant: "ok"; machine: string; state: string }
  | { variant: "invalid"; message: string }
  | { variant: "notfound"; message: string };

export interface MachineConnectInput {
  machine: string;
}

export type MachineConnectOutput =
  { variant: "ok"; machine: string; props: string }
  | { variant: "notfound"; message: string };

export interface MachineDestroyInput {
  machine: string;
}

export type MachineDestroyOutput =
  { variant: "ok"; machine: string }
  | { variant: "notfound"; message: string };

