// generated: SyncEngine/Adapter.swift

import Foundation

class SyncEngineAdapter: ConceptTransport {
    private let handler: any SyncEngineHandler
    private let storage: ConceptStorage

    init(handler: any SyncEngineHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "registerSync":
            let input = try decoder.decode(SyncEngineRegisterSyncInput.self, from: invocation.inputData)
            let output = try await handler.registerSync(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "onCompletion":
            let input = try decoder.decode(SyncEngineOnCompletionInput.self, from: invocation.inputData)
            let output = try await handler.onCompletion(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "evaluateWhere":
            let input = try decoder.decode(SyncEngineEvaluateWhereInput.self, from: invocation.inputData)
            let output = try await handler.evaluateWhere(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "queueSync":
            let input = try decoder.decode(SyncEngineQueueSyncInput.self, from: invocation.inputData)
            let output = try await handler.queueSync(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "onAvailabilityChange":
            let input = try decoder.decode(SyncEngineOnAvailabilityChangeInput.self, from: invocation.inputData)
            let output = try await handler.onAvailabilityChange(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "drainConflicts":
            let input = try decoder.decode(SyncEngineDrainConflictsInput.self, from: invocation.inputData)
            let output = try await handler.drainConflicts(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        default:
            throw ConceptError.unknownAction(invocation.action)
        }
    }

    func query(request: ConceptQuery) async throws -> [Data] {
        try await storage.find(relation: request.relation, args: request.args)
    }

    func health() async throws -> (healthy: Bool, latencyMs: UInt64) {
        (true, 0)
    }
}
