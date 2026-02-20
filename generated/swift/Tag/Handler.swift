// generated: Tag/Handler.swift

import Foundation

protocol TagHandler {
    func add(
        input: TagAddInput,
        storage: ConceptStorage
    ) async throws -> TagAddOutput

    func remove(
        input: TagRemoveInput,
        storage: ConceptStorage
    ) async throws -> TagRemoveOutput

    func list(
        input: TagListInput,
        storage: ConceptStorage
    ) async throws -> TagListOutput

}
