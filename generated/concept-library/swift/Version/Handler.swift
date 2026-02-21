// generated: Version/Handler.swift

import Foundation

protocol VersionHandler {
    func snapshot(
        input: VersionSnapshotInput,
        storage: ConceptStorage
    ) async throws -> VersionSnapshotOutput

    func listVersions(
        input: VersionListVersionsInput,
        storage: ConceptStorage
    ) async throws -> VersionListVersionsOutput

    func rollback(
        input: VersionRollbackInput,
        storage: ConceptStorage
    ) async throws -> VersionRollbackOutput

    func diff(
        input: VersionDiffInput,
        storage: ConceptStorage
    ) async throws -> VersionDiffOutput

}
