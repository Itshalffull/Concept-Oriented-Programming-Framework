// generated: SlotProvider/Adapter.swift

import Foundation

class SlotProviderAdapter: ConceptTransport {
    private let handler: any SlotProviderHandler
    private let storage: ConceptStorage

    init(handler: any SlotProviderHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "initialize":
            let input = try decoder.decode(SlotProviderInitializeInput.self, from: invocation.inputData)
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
        case "define":
            let input = try decoder.decode(SlotProviderDefineInput.self, from: invocation.inputData)
            let output = try await handler.define(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "fill":
            let input = try decoder.decode(SlotProviderFillInput.self, from: invocation.inputData)
            let output = try await handler.fill(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "clear":
            let input = try decoder.decode(SlotProviderClearInput.self, from: invocation.inputData)
            let output = try await handler.clear(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "getSlots":
            let input = try decoder.decode(SlotProviderGetSlotsInput.self, from: invocation.inputData)
            let output = try await handler.getSlots(input: input, storage: storage)
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
