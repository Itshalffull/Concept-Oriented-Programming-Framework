// generated: ProcessSpec/Handler.swift

import Foundation

protocol ProcessSpecHandler {
    func create(
        input: ProcessSpecCreateInput,
        storage: ConceptStorage
    ) async throws -> ProcessSpecCreateOutput

    func publish(
        input: ProcessSpecPublishInput,
        storage: ConceptStorage
    ) async throws -> ProcessSpecPublishOutput

    func deprecate(
        input: ProcessSpecDeprecateInput,
        storage: ConceptStorage
    ) async throws -> ProcessSpecDeprecateOutput

    func update(
        input: ProcessSpecUpdateInput,
        storage: ConceptStorage
    ) async throws -> ProcessSpecUpdateOutput

    func get(
        input: ProcessSpecGetInput,
        storage: ConceptStorage
    ) async throws -> ProcessSpecGetOutput

}
