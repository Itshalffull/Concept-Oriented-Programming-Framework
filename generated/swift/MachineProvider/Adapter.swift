// generated: MachineProvider/Adapter.swift

import Foundation

class MachineProviderAdapter: ConceptTransport {
    private let handler: any MachineProviderHandler
    private let storage: ConceptStorage

    init(handler: any MachineProviderHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "initialize":
            let input = try decoder.decode(MachineProviderInitializeInput.self, from: invocation.inputData)
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
        case "spawn":
            let input = try decoder.decode(MachineProviderSpawnInput.self, from: invocation.inputData)
            let output = try await handler.spawn(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "send":
            let input = try decoder.decode(MachineProviderSendInput.self, from: invocation.inputData)
            let output = try await handler.send(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "connect":
            let input = try decoder.decode(MachineProviderConnectInput.self, from: invocation.inputData)
            let output = try await handler.connect(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "destroy":
            let input = try decoder.decode(MachineProviderDestroyInput.self, from: invocation.inputData)
            let output = try await handler.destroy(input: input, storage: storage)
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
