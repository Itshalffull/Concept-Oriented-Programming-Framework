// generated: group.types.ts

export interface GroupCreateGroupInput {
  group: string;
  name: string;
}

export type GroupCreateGroupOutput =
  { variant: "ok" }
  | { variant: "exists"; message: string };

export interface GroupAddMemberInput {
  group: string;
  user: string;
  role: string;
}

export type GroupAddMemberOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface GroupAssignGroupRoleInput {
  group: string;
  user: string;
  role: string;
}

export type GroupAssignGroupRoleOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface GroupAddContentInput {
  group: string;
  content: string;
}

export type GroupAddContentOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface GroupCheckGroupAccessInput {
  group: string;
  user: string;
  permission: string;
}

export type GroupCheckGroupAccessOutput =
  { variant: "ok"; granted: boolean }
  | { variant: "notfound"; message: string };

