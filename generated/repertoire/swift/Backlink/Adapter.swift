// generated: Backlink/Adapter.swift

import Foundation

class BacklinkAdapter: ConceptTransport {
    private let handler: any BacklinkHandler
    private let storage: ConceptStorage

    init(handler: any BacklinkHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "getBacklinks":
            let input = try decoder.decode(BacklinkGetBacklinksInput.self, from: invocation.inputData)
            let output = try await handler.getBacklinks(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "getUnlinkedMentions":
            let input = try decoder.decode(BacklinkGetUnlinkedMentionsInput.self, from: invocation.inputData)
            let output = try await handler.getUnlinkedMentions(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "reindex":
            let input = try decoder.decode(BacklinkReindexInput.self, from: invocation.inputData)
            let output = try await handler.reindex(input: input, storage: storage)
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
