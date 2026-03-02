// generated: DesignTokenProvider/Adapter.swift

import Foundation

class DesignTokenProviderAdapter: ConceptTransport {
    private let handler: any DesignTokenProviderHandler
    private let storage: ConceptStorage

    init(handler: any DesignTokenProviderHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "initialize":
            let input = try decoder.decode(DesignTokenProviderInitializeInput.self, from: invocation.inputData)
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
        case "resolve":
            let input = try decoder.decode(DesignTokenProviderResolveInput.self, from: invocation.inputData)
            let output = try await handler.resolve(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "switchTheme":
            let input = try decoder.decode(DesignTokenProviderSwitchThemeInput.self, from: invocation.inputData)
            let output = try await handler.switchTheme(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "getTokens":
            let input = try decoder.decode(DesignTokenProviderGetTokensInput.self, from: invocation.inputData)
            let output = try await handler.getTokens(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "export":
            let input = try decoder.decode(DesignTokenProviderExportInput.self, from: invocation.inputData)
            let output = try await handler.export(input: input, storage: storage)
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
