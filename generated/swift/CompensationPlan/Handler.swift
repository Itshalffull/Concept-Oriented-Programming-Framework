// generated: CompensationPlan/Handler.swift

import Foundation

protocol CompensationPlanHandler {
    func register(
        input: CompensationPlanRegisterInput,
        storage: ConceptStorage
    ) async throws -> CompensationPlanRegisterOutput

    func trigger(
        input: CompensationPlanTriggerInput,
        storage: ConceptStorage
    ) async throws -> CompensationPlanTriggerOutput

    func executeNext(
        input: CompensationPlanExecuteNextInput,
        storage: ConceptStorage
    ) async throws -> CompensationPlanExecuteNextOutput

    func markCompensationFailed(
        input: CompensationPlanMarkCompensationFailedInput,
        storage: ConceptStorage
    ) async throws -> CompensationPlanMarkCompensationFailedOutput

}
