// generated: DisplayMode/Adapter.swift

import Foundation

class DisplayModeAdapter: ConceptTransport {
    private let handler: any DisplayModeHandler
    private let storage: ConceptStorage

    init(handler: any DisplayModeHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "defineMode":
            let input = try decoder.decode(DisplayModeDefineModeInput.self, from: invocation.inputData)
            let output = try await handler.defineMode(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "configureFieldDisplay":
            let input = try decoder.decode(DisplayModeConfigureFieldDisplayInput.self, from: invocation.inputData)
            let output = try await handler.configureFieldDisplay(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "configureFieldForm":
            let input = try decoder.decode(DisplayModeConfigureFieldFormInput.self, from: invocation.inputData)
            let output = try await handler.configureFieldForm(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "renderInMode":
            let input = try decoder.decode(DisplayModeRenderInModeInput.self, from: invocation.inputData)
            let output = try await handler.renderInMode(input: input, storage: storage)
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
