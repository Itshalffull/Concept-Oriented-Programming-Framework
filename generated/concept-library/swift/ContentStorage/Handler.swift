// generated: ContentStorage/Handler.swift

import Foundation

protocol ContentStorageHandler {
    func save(
        input: ContentStorageSaveInput,
        storage: ConceptStorage
    ) async throws -> ContentStorageSaveOutput

    func load(
        input: ContentStorageLoadInput,
        storage: ConceptStorage
    ) async throws -> ContentStorageLoadOutput

    func delete(
        input: ContentStorageDeleteInput,
        storage: ConceptStorage
    ) async throws -> ContentStorageDeleteOutput

    func query(
        input: ContentStorageQueryInput,
        storage: ConceptStorage
    ) async throws -> ContentStorageQueryOutput

    func generateSchema(
        input: ContentStorageGenerateSchemaInput,
        storage: ConceptStorage
    ) async throws -> ContentStorageGenerateSchemaOutput

}
