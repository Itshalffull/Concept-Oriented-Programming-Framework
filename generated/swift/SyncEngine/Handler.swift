// generated: SyncEngine/Handler.swift

import Foundation

protocol SyncEngineHandler {
    func registerSync(
        input: SyncEngineRegisterSyncInput,
        storage: ConceptStorage
    ) async throws -> SyncEngineRegisterSyncOutput

    func onCompletion(
        input: SyncEngineOnCompletionInput,
        storage: ConceptStorage
    ) async throws -> SyncEngineOnCompletionOutput

    func evaluateWhere(
        input: SyncEngineEvaluateWhereInput,
        storage: ConceptStorage
    ) async throws -> SyncEngineEvaluateWhereOutput

    func queueSync(
        input: SyncEngineQueueSyncInput,
        storage: ConceptStorage
    ) async throws -> SyncEngineQueueSyncOutput

    func onAvailabilityChange(
        input: SyncEngineOnAvailabilityChangeInput,
        storage: ConceptStorage
    ) async throws -> SyncEngineOnAvailabilityChangeOutput

    func drainConflicts(
        input: SyncEngineDrainConflictsInput,
        storage: ConceptStorage
    ) async throws -> SyncEngineDrainConflictsOutput

}
