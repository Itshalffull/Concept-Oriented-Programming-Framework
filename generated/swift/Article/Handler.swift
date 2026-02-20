// generated: Article/Handler.swift

import Foundation

protocol ArticleHandler {
    func create(
        input: ArticleCreateInput,
        storage: ConceptStorage
    ) async throws -> ArticleCreateOutput

    func update(
        input: ArticleUpdateInput,
        storage: ConceptStorage
    ) async throws -> ArticleUpdateOutput

    func delete(
        input: ArticleDeleteInput,
        storage: ConceptStorage
    ) async throws -> ArticleDeleteOutput

    func get(
        input: ArticleGetInput,
        storage: ConceptStorage
    ) async throws -> ArticleGetOutput

}
