// generated: BindingProvider/Adapter.swift

import Foundation

class BindingProviderAdapter: ConceptTransport {
    private let handler: any BindingProviderHandler
    private let storage: ConceptStorage

    init(handler: any BindingProviderHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "initialize":
            let input = try decoder.decode(BindingProviderInitializeInput.self, from: invocation.inputData)
            let output = try await handler.initialize(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "bind":
            let input = try decoder.decode(BindingProviderBindInput.self, from: invocation.inputData)
            let output = try await handler.bind(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "sync":
            let input = try decoder.decode(BindingProviderSyncInput.self, from: invocation.inputData)
            let output = try await handler.sync(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "invoke":
            let input = try decoder.decode(BindingProviderInvokeInput.self, from: invocation.inputData)
            let output = try await handler.invoke(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "unbind":
            let input = try decoder.decode(BindingProviderUnbindInput.self, from: invocation.inputData)
            let output = try await handler.unbind(input: input, storage: storage)
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
