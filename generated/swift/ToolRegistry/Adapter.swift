// generated: ToolRegistry/Adapter.swift

import Foundation

class ToolRegistryAdapter: ConceptTransport {
    private let handler: any ToolRegistryHandler
    private let storage: ConceptStorage

    init(handler: any ToolRegistryHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "register":
            let input = try decoder.decode(ToolRegistryRegisterInput.self, from: invocation.inputData)
            let output = try await handler.register(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "deprecate":
            let input = try decoder.decode(ToolRegistryDeprecateInput.self, from: invocation.inputData)
            let output = try await handler.deprecate(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "disable":
            let input = try decoder.decode(ToolRegistryDisableInput.self, from: invocation.inputData)
            let output = try await handler.disable(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "authorize":
            let input = try decoder.decode(ToolRegistryAuthorizeInput.self, from: invocation.inputData)
            let output = try await handler.authorize(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "checkAccess":
            let input = try decoder.decode(ToolRegistryCheckAccessInput.self, from: invocation.inputData)
            let output = try await handler.checkAccess(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "listActive":
            let input = try decoder.decode(ToolRegistryListActiveInput.self, from: invocation.inputData)
            let output = try await handler.listActive(input: input, storage: storage)
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
