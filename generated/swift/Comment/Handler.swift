// generated: Comment/Handler.swift

import Foundation

protocol CommentHandler {
    func create(
        input: CommentCreateInput,
        storage: ConceptStorage
    ) async throws -> CommentCreateOutput

    func delete(
        input: CommentDeleteInput,
        storage: ConceptStorage
    ) async throws -> CommentDeleteOutput

    func list(
        input: CommentListInput,
        storage: ConceptStorage
    ) async throws -> CommentListOutput

}
