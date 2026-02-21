// generated: session.types.ts

export interface SessionCreateInput {
  session: string;
  userId: string;
  device: string;
}

export type SessionCreateOutput =
  { variant: "ok"; token: string }
  | { variant: "error"; message: string };

export interface SessionValidateInput {
  session: string;
}

export type SessionValidateOutput =
  { variant: "ok"; valid: boolean }
  | { variant: "notfound"; message: string };

export interface SessionRefreshInput {
  session: string;
}

export type SessionRefreshOutput =
  { variant: "ok"; token: string }
  | { variant: "notfound"; message: string }
  | { variant: "expired"; message: string };

export interface SessionDestroyInput {
  session: string;
}

export type SessionDestroyOutput =
  { variant: "ok"; session: string }
  | { variant: "notfound"; message: string };

export interface SessionDestroyAllInput {
  userId: string;
}

export type SessionDestroyAllOutput =
  { variant: "ok"; userId: string };

export interface SessionGetContextInput {
  session: string;
}

export type SessionGetContextOutput =
  { variant: "ok"; userId: string; device: string }
  | { variant: "notfound"; message: string };

