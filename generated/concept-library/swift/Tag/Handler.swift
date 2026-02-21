// generated: Tag/Handler.swift

import Foundation

protocol TagHandler {
    func addTag(
        input: TagAddTagInput,
        storage: ConceptStorage
    ) async throws -> TagAddTagOutput

    func removeTag(
        input: TagRemoveTagInput,
        storage: ConceptStorage
    ) async throws -> TagRemoveTagOutput

    func getByTag(
        input: TagGetByTagInput,
        storage: ConceptStorage
    ) async throws -> TagGetByTagOutput

    func getChildren(
        input: TagGetChildrenInput,
        storage: ConceptStorage
    ) async throws -> TagGetChildrenOutput

    func rename(
        input: TagRenameInput,
        storage: ConceptStorage
    ) async throws -> TagRenameOutput

}
