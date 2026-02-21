// generated: ContentNode/Handler.swift

import Foundation

protocol ContentNodeHandler {
    func create(
        input: ContentNodeCreateInput,
        storage: ConceptStorage
    ) async throws -> ContentNodeCreateOutput

    func update(
        input: ContentNodeUpdateInput,
        storage: ConceptStorage
    ) async throws -> ContentNodeUpdateOutput

    func delete(
        input: ContentNodeDeleteInput,
        storage: ConceptStorage
    ) async throws -> ContentNodeDeleteOutput

    func get(
        input: ContentNodeGetInput,
        storage: ConceptStorage
    ) async throws -> ContentNodeGetOutput

    func setMetadata(
        input: ContentNodeSetMetadataInput,
        storage: ConceptStorage
    ) async throws -> ContentNodeSetMetadataOutput

    func changeType(
        input: ContentNodeChangeTypeInput,
        storage: ConceptStorage
    ) async throws -> ContentNodeChangeTypeOutput

}
