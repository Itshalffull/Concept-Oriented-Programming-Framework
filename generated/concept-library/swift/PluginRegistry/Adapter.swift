// generated: PluginRegistry/Adapter.swift

import Foundation

class PluginRegistryAdapter: ConceptTransport {
    private let handler: any PluginRegistryHandler
    private let storage: ConceptStorage

    init(handler: any PluginRegistryHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "discover":
            let input = try decoder.decode(PluginRegistryDiscoverInput.self, from: invocation.inputData)
            let output = try await handler.discover(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "createInstance":
            let input = try decoder.decode(PluginRegistryCreateInstanceInput.self, from: invocation.inputData)
            let output = try await handler.createInstance(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "getDefinitions":
            let input = try decoder.decode(PluginRegistryGetDefinitionsInput.self, from: invocation.inputData)
            let output = try await handler.getDefinitions(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "alterDefinitions":
            let input = try decoder.decode(PluginRegistryAlterDefinitionsInput.self, from: invocation.inputData)
            let output = try await handler.alterDefinitions(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "derivePlugins":
            let input = try decoder.decode(PluginRegistryDerivePluginsInput.self, from: invocation.inputData)
            let output = try await handler.derivePlugins(input: input, storage: storage)
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
