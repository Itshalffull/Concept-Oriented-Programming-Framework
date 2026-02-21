// generated: SearchIndex/Handler.swift

import Foundation

protocol SearchIndexHandler {
    func createIndex(
        input: SearchIndexCreateIndexInput,
        storage: ConceptStorage
    ) async throws -> SearchIndexCreateIndexOutput

    func indexItem(
        input: SearchIndexIndexItemInput,
        storage: ConceptStorage
    ) async throws -> SearchIndexIndexItemOutput

    func removeItem(
        input: SearchIndexRemoveItemInput,
        storage: ConceptStorage
    ) async throws -> SearchIndexRemoveItemOutput

    func search(
        input: SearchIndexSearchInput,
        storage: ConceptStorage
    ) async throws -> SearchIndexSearchOutput

    func addProcessor(
        input: SearchIndexAddProcessorInput,
        storage: ConceptStorage
    ) async throws -> SearchIndexAddProcessorOutput

    func reindex(
        input: SearchIndexReindexInput,
        storage: ConceptStorage
    ) async throws -> SearchIndexReindexOutput

}
