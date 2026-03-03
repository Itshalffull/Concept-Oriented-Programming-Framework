// generated: VerificationRun/Handler.swift

import Foundation

protocol VerificationRunHandler {
    func start(
        input: VerificationRunStartInput,
        storage: ConceptStorage
    ) async throws -> VerificationRunStartOutput

    func complete(
        input: VerificationRunCompleteInput,
        storage: ConceptStorage
    ) async throws -> VerificationRunCompleteOutput

    func timeout(
        input: VerificationRunTimeoutInput,
        storage: ConceptStorage
    ) async throws -> VerificationRunTimeoutOutput

    func cancel(
        input: VerificationRunCancelInput,
        storage: ConceptStorage
    ) async throws -> VerificationRunCancelOutput

    func get_status(
        input: VerificationRunGet_statusInput,
        storage: ConceptStorage
    ) async throws -> VerificationRunGet_statusOutput

    func compare(
        input: VerificationRunCompareInput,
        storage: ConceptStorage
    ) async throws -> VerificationRunCompareOutput

}