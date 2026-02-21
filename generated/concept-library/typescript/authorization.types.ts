// generated: authorization.types.ts

export interface AuthorizationGrantPermissionInput {
  role: string;
  permission: string;
}

export type AuthorizationGrantPermissionOutput =
  { variant: "ok"; role: string; permission: string }
  | { variant: "notfound"; message: string };

export interface AuthorizationRevokePermissionInput {
  role: string;
  permission: string;
}

export type AuthorizationRevokePermissionOutput =
  { variant: "ok"; role: string; permission: string }
  | { variant: "notfound"; message: string };

export interface AuthorizationAssignRoleInput {
  user: string;
  role: string;
}

export type AuthorizationAssignRoleOutput =
  { variant: "ok"; user: string; role: string }
  | { variant: "notfound"; message: string };

export interface AuthorizationCheckPermissionInput {
  user: string;
  permission: string;
}

export type AuthorizationCheckPermissionOutput =
  { variant: "ok"; granted: boolean };

