// generated: AccessControl/Handler.swift

import Foundation

protocol AccessControlHandler {
    func check(
        input: AccessControlCheckInput,
        storage: ConceptStorage
    ) async throws -> AccessControlCheckOutput

    func orIf(
        input: AccessControlOrIfInput,
        storage: ConceptStorage
    ) async throws -> AccessControlOrIfOutput

    func andIf(
        input: AccessControlAndIfInput,
        storage: ConceptStorage
    ) async throws -> AccessControlAndIfOutput

}
