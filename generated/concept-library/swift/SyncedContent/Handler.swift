// generated: SyncedContent/Handler.swift

import Foundation

protocol SyncedContentHandler {
    func createReference(
        input: SyncedContentCreateReferenceInput,
        storage: ConceptStorage
    ) async throws -> SyncedContentCreateReferenceOutput

    func editOriginal(
        input: SyncedContentEditOriginalInput,
        storage: ConceptStorage
    ) async throws -> SyncedContentEditOriginalOutput

    func deleteReference(
        input: SyncedContentDeleteReferenceInput,
        storage: ConceptStorage
    ) async throws -> SyncedContentDeleteReferenceOutput

    func convertToIndependent(
        input: SyncedContentConvertToIndependentInput,
        storage: ConceptStorage
    ) async throws -> SyncedContentConvertToIndependentOutput

}
