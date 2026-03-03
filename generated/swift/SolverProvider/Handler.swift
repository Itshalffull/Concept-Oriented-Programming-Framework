// generated: SolverProvider/Handler.swift

import Foundation

protocol SolverProviderHandler {
    func register(
        input: SolverProviderRegisterInput,
        storage: ConceptStorage
    ) async throws -> SolverProviderRegisterOutput

    func dispatch(
        input: SolverProviderDispatchInput,
        storage: ConceptStorage
    ) async throws -> SolverProviderDispatchOutput

    func dispatch_batch(
        input: SolverProviderDispatch_batchInput,
        storage: ConceptStorage
    ) async throws -> SolverProviderDispatch_batchOutput

    func health_check(
        input: SolverProviderHealth_checkInput,
        storage: ConceptStorage
    ) async throws -> SolverProviderHealth_checkOutput

    func list(
        input: SolverProviderListInput,
        storage: ConceptStorage
    ) async throws -> SolverProviderListOutput

    func unregister(
        input: SolverProviderUnregisterInput,
        storage: ConceptStorage
    ) async throws -> SolverProviderUnregisterOutput

}