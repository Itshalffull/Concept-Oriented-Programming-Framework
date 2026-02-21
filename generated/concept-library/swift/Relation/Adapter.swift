// generated: Relation/Adapter.swift

import Foundation

class RelationAdapter: ConceptTransport {
    private let handler: any RelationHandler
    private let storage: ConceptStorage

    init(handler: any RelationHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "defineRelation":
            let input = try decoder.decode(RelationDefineRelationInput.self, from: invocation.inputData)
            let output = try await handler.defineRelation(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "link":
            let input = try decoder.decode(RelationLinkInput.self, from: invocation.inputData)
            let output = try await handler.link(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "unlink":
            let input = try decoder.decode(RelationUnlinkInput.self, from: invocation.inputData)
            let output = try await handler.unlink(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "getRelated":
            let input = try decoder.decode(RelationGetRelatedInput.self, from: invocation.inputData)
            let output = try await handler.getRelated(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "defineRollup":
            let input = try decoder.decode(RelationDefineRollupInput.self, from: invocation.inputData)
            let output = try await handler.defineRollup(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "computeRollup":
            let input = try decoder.decode(RelationComputeRollupInput.self, from: invocation.inputData)
            let output = try await handler.computeRollup(input: input, storage: storage)
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
