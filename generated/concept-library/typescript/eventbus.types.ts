// generated: eventbus.types.ts

export interface EventBusRegisterEventTypeInput {
  name: string;
  schema: string;
}

export type EventBusRegisterEventTypeOutput =
  { variant: "ok" }
  | { variant: "exists" };

export interface EventBusSubscribeInput {
  event: string;
  handler: string;
  priority: number;
}

export type EventBusSubscribeOutput =
  { variant: "ok"; subscriptionId: string };

export interface EventBusUnsubscribeInput {
  subscriptionId: string;
}

export type EventBusUnsubscribeOutput =
  { variant: "ok" }
  | { variant: "notfound" };

export interface EventBusDispatchInput {
  event: string;
  data: string;
}

export type EventBusDispatchOutput =
  { variant: "ok"; results: string }
  | { variant: "error"; message: string };

export interface EventBusDispatchAsyncInput {
  event: string;
  data: string;
}

export type EventBusDispatchAsyncOutput =
  { variant: "ok"; jobId: string }
  | { variant: "error"; message: string };

export interface EventBusGetHistoryInput {
  event: string;
  limit: number;
}

export type EventBusGetHistoryOutput =
  { variant: "ok"; entries: string };

