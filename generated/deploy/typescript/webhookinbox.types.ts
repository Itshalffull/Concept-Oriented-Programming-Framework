// generated: webhookinbox.types.ts

export interface WebhookInboxRegisterInput {
  runRef: string;
  stepRef: string;
  eventType: string;
  correlationKey: string;
}

export type WebhookInboxRegisterOutput =
  { variant: "ok"; hook: string; runRef: string };

export interface WebhookInboxReceiveInput {
  correlationKey: string;
  eventType: string;
  payload: string;
}

export type WebhookInboxReceiveOutput =
  | { variant: "ok"; hook: string; runRef: string; stepRef: string; payload: string }
  | { variant: "noMatch"; correlationKey: string };

export interface WebhookInboxExpireInput {
  hook: string;
}

export type WebhookInboxExpireOutput =
  | { variant: "ok"; hook: string; runRef: string; stepRef: string }
  | { variant: "notWaiting"; hook: string };

export interface WebhookInboxAckInput {
  hook: string;
}

export type WebhookInboxAckOutput =
  | { variant: "ok"; hook: string }
  | { variant: "notReceived"; hook: string };
