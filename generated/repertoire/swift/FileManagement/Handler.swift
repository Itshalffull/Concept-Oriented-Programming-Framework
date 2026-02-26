// generated: FileManagement/Handler.swift

import Foundation

protocol FileManagementHandler {
    func upload(
        input: FileManagementUploadInput,
        storage: ConceptStorage
    ) async throws -> FileManagementUploadOutput

    func addUsage(
        input: FileManagementAddUsageInput,
        storage: ConceptStorage
    ) async throws -> FileManagementAddUsageOutput

    func removeUsage(
        input: FileManagementRemoveUsageInput,
        storage: ConceptStorage
    ) async throws -> FileManagementRemoveUsageOutput

    func garbageCollect(
        input: FileManagementGarbageCollectInput,
        storage: ConceptStorage
    ) async throws -> FileManagementGarbageCollectOutput

    func getFile(
        input: FileManagementGetFileInput,
        storage: ConceptStorage
    ) async throws -> FileManagementGetFileOutput

}
