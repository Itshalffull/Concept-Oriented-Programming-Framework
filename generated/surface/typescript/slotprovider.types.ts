// generated: slotprovider.types.ts

export interface SlotProviderInitializeInput {
  config: Record<string, unknown>;
}

export type SlotProviderInitializeOutput =
  { variant: "ok"; provider: string; pluginRef: string }
  | { variant: "configError"; message: string };

export interface SlotProviderDefineInput {
  slotId: string;
  name: string;
  accepts: string[];
  required: boolean;
}

export type SlotProviderDefineOutput =
  { variant: "ok"; slotId: string }
  | { variant: "duplicate"; message: string };

export interface SlotProviderFillInput {
  slotId: string;
  contentId: string;
  contentType: string;
  content: unknown;
}

export type SlotProviderFillOutput =
  { variant: "ok"; slotId: string; contentId: string }
  | { variant: "notfound"; message: string }
  | { variant: "rejected"; message: string };

export interface SlotProviderClearInput {
  slotId: string;
}

export type SlotProviderClearOutput =
  { variant: "ok"; slotId: string }
  | { variant: "notfound"; message: string };

export interface SlotProviderGetSlotsInput {
  filter?: Record<string, string>;
}

export type SlotProviderGetSlotsOutput =
  { variant: "ok"; slots: Array<{ slotId: string; name: string; filled: boolean; contentType: string | null }> };
