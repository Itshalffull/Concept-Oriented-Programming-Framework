// generated: Namespace/Adapter.swift

import Foundation

class NamespaceAdapter: ConceptTransport {
    private let handler: any NamespaceHandler
    private let storage: ConceptStorage

    init(handler: any NamespaceHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "createNamespacedPage":
            let input = try decoder.decode(NamespaceCreateNamespacedPageInput.self, from: invocation.inputData)
            let output = try await handler.createNamespacedPage(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "getChildren":
            let input = try decoder.decode(NamespaceGetChildrenInput.self, from: invocation.inputData)
            let output = try await handler.getChildren(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "getHierarchy":
            let input = try decoder.decode(NamespaceGetHierarchyInput.self, from: invocation.inputData)
            let output = try await handler.getHierarchy(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "move":
            let input = try decoder.decode(NamespaceMoveInput.self, from: invocation.inputData)
            let output = try await handler.move(input: input, storage: storage)
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
