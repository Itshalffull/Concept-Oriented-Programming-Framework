// generated: ProcessRun/Handler.swift

import Foundation

protocol ProcessRunHandler {
    func start(
        input: ProcessRunStartInput,
        storage: ConceptStorage
    ) async throws -> ProcessRunStartOutput

    func startChild(
        input: ProcessRunStartChildInput,
        storage: ConceptStorage
    ) async throws -> ProcessRunStartChildOutput

    func complete(
        input: ProcessRunCompleteInput,
        storage: ConceptStorage
    ) async throws -> ProcessRunCompleteOutput

    func fail(
        input: ProcessRunFailInput,
        storage: ConceptStorage
    ) async throws -> ProcessRunFailOutput

    func cancel(
        input: ProcessRunCancelInput,
        storage: ConceptStorage
    ) async throws -> ProcessRunCancelOutput

    func suspend(
        input: ProcessRunSuspendInput,
        storage: ConceptStorage
    ) async throws -> ProcessRunSuspendOutput

    func resume(
        input: ProcessRunResumeInput,
        storage: ConceptStorage
    ) async throws -> ProcessRunResumeOutput

    func getStatus(
        input: ProcessRunGetStatusInput,
        storage: ConceptStorage
    ) async throws -> ProcessRunGetStatusOutput

}
