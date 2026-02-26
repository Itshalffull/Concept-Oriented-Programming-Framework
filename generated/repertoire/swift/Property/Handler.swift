// generated: Property/Handler.swift

import Foundation

protocol PropertyHandler {
    func set(
        input: PropertySetInput,
        storage: ConceptStorage
    ) async throws -> PropertySetOutput

    func get(
        input: PropertyGetInput,
        storage: ConceptStorage
    ) async throws -> PropertyGetOutput

    func delete(
        input: PropertyDeleteInput,
        storage: ConceptStorage
    ) async throws -> PropertyDeleteOutput

    func defineType(
        input: PropertyDefineTypeInput,
        storage: ConceptStorage
    ) async throws -> PropertyDefineTypeOutput

    func listAll(
        input: PropertyListAllInput,
        storage: ConceptStorage
    ) async throws -> PropertyListAllOutput

}
