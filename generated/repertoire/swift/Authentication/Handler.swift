// generated: Authentication/Handler.swift

import Foundation

protocol AuthenticationHandler {
    func register(
        input: AuthenticationRegisterInput,
        storage: ConceptStorage
    ) async throws -> AuthenticationRegisterOutput

    func login(
        input: AuthenticationLoginInput,
        storage: ConceptStorage
    ) async throws -> AuthenticationLoginOutput

    func logout(
        input: AuthenticationLogoutInput,
        storage: ConceptStorage
    ) async throws -> AuthenticationLogoutOutput

    func authenticate(
        input: AuthenticationAuthenticateInput,
        storage: ConceptStorage
    ) async throws -> AuthenticationAuthenticateOutput

    func resetPassword(
        input: AuthenticationResetPasswordInput,
        storage: ConceptStorage
    ) async throws -> AuthenticationResetPasswordOutput

}
