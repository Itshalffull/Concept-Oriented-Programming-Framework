// generated: Pathauto/Adapter.swift

import Foundation

class PathautoAdapter: ConceptTransport {
    private let handler: any PathautoHandler
    private let storage: ConceptStorage

    init(handler: any PathautoHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "generateAlias":
            let input = try decoder.decode(PathautoGenerateAliasInput.self, from: invocation.inputData)
            let output = try await handler.generateAlias(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "bulkGenerate":
            let input = try decoder.decode(PathautoBulkGenerateInput.self, from: invocation.inputData)
            let output = try await handler.bulkGenerate(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "cleanString":
            let input = try decoder.decode(PathautoCleanStringInput.self, from: invocation.inputData)
            let output = try await handler.cleanString(input: input, storage: storage)
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
