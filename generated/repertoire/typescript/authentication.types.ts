// generated: authentication.types.ts

export interface AuthenticationRegisterInput {
  user: string;
  provider: string;
  credentials: string;
}

export type AuthenticationRegisterOutput =
  { variant: "ok"; user: string }
  | { variant: "exists"; message: string };

export interface AuthenticationLoginInput {
  user: string;
  credentials: string;
}

export type AuthenticationLoginOutput =
  { variant: "ok"; token: string }
  | { variant: "invalid"; message: string };

export interface AuthenticationLogoutInput {
  user: string;
}

export type AuthenticationLogoutOutput =
  { variant: "ok"; user: string }
  | { variant: "notfound"; message: string };

export interface AuthenticationAuthenticateInput {
  token: string;
}

export type AuthenticationAuthenticateOutput =
  { variant: "ok"; user: string }
  | { variant: "invalid"; message: string };

export interface AuthenticationResetPasswordInput {
  user: string;
  newCredentials: string;
}

export type AuthenticationResetPasswordOutput =
  { variant: "ok"; user: string }
  | { variant: "notfound"; message: string };

