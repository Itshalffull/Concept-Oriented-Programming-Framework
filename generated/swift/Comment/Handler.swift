// generated: Comment/Handler.swift

import Foundation

protocol CommentHandler {
    func addComment(
        input: CommentAddCommentInput,
        storage: ConceptStorage
    ) async throws -> CommentAddCommentOutput

    func reply(
        input: CommentReplyInput,
        storage: ConceptStorage
    ) async throws -> CommentReplyOutput

    func publish(
        input: CommentPublishInput,
        storage: ConceptStorage
    ) async throws -> CommentPublishOutput

    func unpublish(
        input: CommentUnpublishInput,
        storage: ConceptStorage
    ) async throws -> CommentUnpublishOutput

    func delete(
        input: CommentDeleteInput,
        storage: ConceptStorage
    ) async throws -> CommentDeleteOutput

}
