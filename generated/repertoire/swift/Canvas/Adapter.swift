// generated: Canvas/Adapter.swift

import Foundation

class CanvasAdapter: ConceptTransport {
    private let handler: any CanvasHandler
    private let storage: ConceptStorage

    init(handler: any CanvasHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "addNode":
            let input = try decoder.decode(CanvasAddNodeInput.self, from: invocation.inputData)
            let output = try await handler.addNode(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "moveNode":
            let input = try decoder.decode(CanvasMoveNodeInput.self, from: invocation.inputData)
            let output = try await handler.moveNode(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "connectNodes":
            let input = try decoder.decode(CanvasConnectNodesInput.self, from: invocation.inputData)
            let output = try await handler.connectNodes(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "groupNodes":
            let input = try decoder.decode(CanvasGroupNodesInput.self, from: invocation.inputData)
            let output = try await handler.groupNodes(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "embedFile":
            let input = try decoder.decode(CanvasEmbedFileInput.self, from: invocation.inputData)
            let output = try await handler.embedFile(input: input, storage: storage)
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
