// generated: accesscontrol.types.ts

export interface AccessControlCheckInput {
  resource: string;
  action: string;
  context: string;
}

export type AccessControlCheckOutput =
  { variant: "ok"; result: string; tags: string; maxAge: number };

export interface AccessControlOrIfInput {
  left: string;
  right: string;
}

export type AccessControlOrIfOutput =
  { variant: "ok"; result: string };

export interface AccessControlAndIfInput {
  left: string;
  right: string;
}

export type AccessControlAndIfOutput =
  { variant: "ok"; result: string };

