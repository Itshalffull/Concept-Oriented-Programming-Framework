// generated: Graph/Adapter.swift

import Foundation

class GraphAdapter: ConceptTransport {
    private let handler: any GraphHandler
    private let storage: ConceptStorage

    init(handler: any GraphHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "addNode":
            let input = try decoder.decode(GraphAddNodeInput.self, from: invocation.inputData)
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
        case "removeNode":
            let input = try decoder.decode(GraphRemoveNodeInput.self, from: invocation.inputData)
            let output = try await handler.removeNode(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "addEdge":
            let input = try decoder.decode(GraphAddEdgeInput.self, from: invocation.inputData)
            let output = try await handler.addEdge(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "removeEdge":
            let input = try decoder.decode(GraphRemoveEdgeInput.self, from: invocation.inputData)
            let output = try await handler.removeEdge(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "computeLayout":
            let input = try decoder.decode(GraphComputeLayoutInput.self, from: invocation.inputData)
            let output = try await handler.computeLayout(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "getNeighbors":
            let input = try decoder.decode(GraphGetNeighborsInput.self, from: invocation.inputData)
            let output = try await handler.getNeighbors(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "filterNodes":
            let input = try decoder.decode(GraphFilterNodesInput.self, from: invocation.inputData)
            let output = try await handler.filterNodes(input: input, storage: storage)
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
