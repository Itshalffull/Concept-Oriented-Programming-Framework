// generated: Cache/Handler.swift

import Foundation

protocol CacheHandler {
    func set(
        input: CacheSetInput,
        storage: ConceptStorage
    ) async throws -> CacheSetOutput

    func get(
        input: CacheGetInput,
        storage: ConceptStorage
    ) async throws -> CacheGetOutput

    func invalidate(
        input: CacheInvalidateInput,
        storage: ConceptStorage
    ) async throws -> CacheInvalidateOutput

    func invalidateByTags(
        input: CacheInvalidateByTagsInput,
        storage: ConceptStorage
    ) async throws -> CacheInvalidateByTagsOutput

}
