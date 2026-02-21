// generated: cache.types.ts

export interface CacheSetInput {
  bin: string;
  key: string;
  data: string;
  tags: string;
  maxAge: number;
}

export type CacheSetOutput =
  { variant: "ok" };

export interface CacheGetInput {
  bin: string;
  key: string;
}

export type CacheGetOutput =
  { variant: "ok"; data: string }
  | { variant: "miss" };

export interface CacheInvalidateInput {
  bin: string;
  key: string;
}

export type CacheInvalidateOutput =
  { variant: "ok" }
  | { variant: "notfound" };

export interface CacheInvalidateByTagsInput {
  tags: string;
}

export type CacheInvalidateByTagsOutput =
  { variant: "ok"; count: number };

