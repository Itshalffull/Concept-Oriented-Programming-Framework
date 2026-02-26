// generated: ConfigSync/Handler.swift

import Foundation

protocol ConfigSyncHandler {
    func export(
        input: ConfigSyncExportInput,
        storage: ConceptStorage
    ) async throws -> ConfigSyncExportOutput

    func import(
        input: ConfigSyncImportInput,
        storage: ConceptStorage
    ) async throws -> ConfigSyncImportOutput

    func override(
        input: ConfigSyncOverrideInput,
        storage: ConceptStorage
    ) async throws -> ConfigSyncOverrideOutput

    func diff(
        input: ConfigSyncDiffInput,
        storage: ConceptStorage
    ) async throws -> ConfigSyncDiffOutput

}
