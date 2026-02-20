// generated: Migration/Handler.swift

import Foundation

protocol MigrationHandler {
    func check(
        input: MigrationCheckInput,
        storage: ConceptStorage
    ) async throws -> MigrationCheckOutput

    func complete(
        input: MigrationCompleteInput,
        storage: ConceptStorage
    ) async throws -> MigrationCompleteOutput

}
