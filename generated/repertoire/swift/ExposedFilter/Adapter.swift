// generated: ExposedFilter/Adapter.swift

import Foundation

class ExposedFilterAdapter: ConceptTransport {
    private let handler: any ExposedFilterHandler
    private let storage: ConceptStorage

    init(handler: any ExposedFilterHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "expose":
            let input = try decoder.decode(ExposedFilterExposeInput.self, from: invocation.inputData)
            let output = try await handler.expose(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "collectInput":
            let input = try decoder.decode(ExposedFilterCollectInputInput.self, from: invocation.inputData)
            let output = try await handler.collectInput(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "applyToQuery":
            let input = try decoder.decode(ExposedFilterApplyToQueryInput.self, from: invocation.inputData)
            let output = try await handler.applyToQuery(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "resetToDefaults":
            let input = try decoder.decode(ExposedFilterResetToDefaultsInput.self, from: invocation.inputData)
            let output = try await handler.resetToDefaults(input: input, storage: storage)
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
