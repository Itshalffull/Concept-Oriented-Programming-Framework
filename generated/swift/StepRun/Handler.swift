// generated: StepRun/Handler.swift

import Foundation

protocol StepRunHandler {
    func start(
        input: StepRunStartInput,
        storage: ConceptStorage
    ) async throws -> StepRunStartOutput

    func complete(
        input: StepRunCompleteInput,
        storage: ConceptStorage
    ) async throws -> StepRunCompleteOutput

    func fail(
        input: StepRunFailInput,
        storage: ConceptStorage
    ) async throws -> StepRunFailOutput

    func cancel(
        input: StepRunCancelInput,
        storage: ConceptStorage
    ) async throws -> StepRunCancelOutput

    func skip(
        input: StepRunSkipInput,
        storage: ConceptStorage
    ) async throws -> StepRunSkipOutput

    func get(
        input: StepRunGetInput,
        storage: ConceptStorage
    ) async throws -> StepRunGetOutput

}
