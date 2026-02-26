// generated: Taxonomy/Adapter.swift

import Foundation

class TaxonomyAdapter: ConceptTransport {
    private let handler: any TaxonomyHandler
    private let storage: ConceptStorage

    init(handler: any TaxonomyHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "createVocabulary":
            let input = try decoder.decode(TaxonomyCreateVocabularyInput.self, from: invocation.inputData)
            let output = try await handler.createVocabulary(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "addTerm":
            let input = try decoder.decode(TaxonomyAddTermInput.self, from: invocation.inputData)
            let output = try await handler.addTerm(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "setParent":
            let input = try decoder.decode(TaxonomySetParentInput.self, from: invocation.inputData)
            let output = try await handler.setParent(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "tagEntity":
            let input = try decoder.decode(TaxonomyTagEntityInput.self, from: invocation.inputData)
            let output = try await handler.tagEntity(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "untagEntity":
            let input = try decoder.decode(TaxonomyUntagEntityInput.self, from: invocation.inputData)
            let output = try await handler.untagEntity(input: input, storage: storage)
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
