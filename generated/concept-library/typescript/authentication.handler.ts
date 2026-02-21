// generated: authentication.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./authentication.types";

export interface AuthenticationHandler {
  register(input: T.AuthenticationRegisterInput, storage: ConceptStorage):
    Promise<T.AuthenticationRegisterOutput>;
  login(input: T.AuthenticationLoginInput, storage: ConceptStorage):
    Promise<T.AuthenticationLoginOutput>;
  logout(input: T.AuthenticationLogoutInput, storage: ConceptStorage):
    Promise<T.AuthenticationLogoutOutput>;
  authenticate(input: T.AuthenticationAuthenticateInput, storage: ConceptStorage):
    Promise<T.AuthenticationAuthenticateOutput>;
  resetPassword(input: T.AuthenticationResetPasswordInput, storage: ConceptStorage):
    Promise<T.AuthenticationResetPasswordOutput>;
}
