// generated: Profile/Handler.swift

import Foundation

protocol ProfileHandler {
    func update(
        input: ProfileUpdateInput,
        storage: ConceptStorage
    ) async throws -> ProfileUpdateOutput

    func get(
        input: ProfileGetInput,
        storage: ConceptStorage
    ) async throws -> ProfileGetOutput

}
