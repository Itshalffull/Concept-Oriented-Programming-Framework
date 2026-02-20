// generated: Password/Handler.swift

import Foundation

protocol PasswordHandler {
    func set(
        input: PasswordSetInput,
        storage: ConceptStorage
    ) async throws -> PasswordSetOutput

    func check(
        input: PasswordCheckInput,
        storage: ConceptStorage
    ) async throws -> PasswordCheckOutput

    func validate(
        input: PasswordValidateInput,
        storage: ConceptStorage
    ) async throws -> PasswordValidateOutput

}
