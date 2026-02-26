// generated: Renderer/Adapter.swift

import Foundation

class RendererAdapter: ConceptTransport {
    private let handler: any RendererHandler
    private let storage: ConceptStorage

    init(handler: any RendererHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "render":
            let input = try decoder.decode(RendererRenderInput.self, from: invocation.inputData)
            let output = try await handler.render(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "autoPlaceholder":
            let input = try decoder.decode(RendererAutoPlaceholderInput.self, from: invocation.inputData)
            let output = try await handler.autoPlaceholder(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "stream":
            let input = try decoder.decode(RendererStreamInput.self, from: invocation.inputData)
            let output = try await handler.stream(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "mergeCacheability":
            let input = try decoder.decode(RendererMergeCacheabilityInput.self, from: invocation.inputData)
            let output = try await handler.mergeCacheability(input: input, storage: storage)
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
