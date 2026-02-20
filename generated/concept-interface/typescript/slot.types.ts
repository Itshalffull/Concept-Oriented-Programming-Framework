// generated: slot.types.ts

export interface SlotDefineInput {
  slot: string;
  name: string;
  component: string;
}

export type SlotDefineOutput =
  { variant: "ok"; slot: string }
  | { variant: "invalid"; message: string };

export interface SlotFillInput {
  slot: string;
  content: string;
}

export type SlotFillOutput =
  { variant: "ok"; slot: string }
  | { variant: "notfound"; message: string };

export interface SlotSetDefaultInput {
  slot: string;
  defaultContent: string;
}

export type SlotSetDefaultOutput =
  { variant: "ok"; slot: string }
  | { variant: "notfound"; message: string };

export interface SlotClearInput {
  slot: string;
}

export type SlotClearOutput =
  { variant: "ok"; slot: string }
  | { variant: "notfound"; message: string };

