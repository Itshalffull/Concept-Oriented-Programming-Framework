// generated: queue.types.ts

export interface QueueEnqueueInput {
  queue: string;
  item: string;
  priority: number;
}

export type QueueEnqueueOutput =
  { variant: "ok"; itemId: string }
  | { variant: "notfound"; message: string };

export interface QueueClaimInput {
  queue: string;
  worker: string;
}

export type QueueClaimOutput =
  { variant: "ok"; item: string }
  | { variant: "empty"; message: string };

export interface QueueProcessInput {
  queue: string;
  itemId: string;
  result: string;
}

export type QueueProcessOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface QueueReleaseInput {
  queue: string;
  itemId: string;
}

export type QueueReleaseOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface QueueDeleteInput {
  queue: string;
  itemId: string;
}

export type QueueDeleteOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

