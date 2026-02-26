// generated: SyncedContent/Adapter.swift

import Foundation

class SyncedContentAdapter: ConceptTransport {
    private let handler: any SyncedContentHandler
    private let storage: ConceptStorage

    init(handler: any SyncedContentHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "createReference":
            let input = try decoder.decode(SyncedContentCreateReferenceInput.self, from: invocation.inputData)
            let output = try await handler.createReference(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "editOriginal":
            let input = try decoder.decode(SyncedContentEditOriginalInput.self, from: invocation.inputData)
            let output = try await handler.editOriginal(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "deleteReference":
            let input = try decoder.decode(SyncedContentDeleteReferenceInput.self, from: invocation.inputData)
            let output = try await handler.deleteReference(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "convertToIndependent":
            let input = try decoder.decode(SyncedContentConvertToIndependentInput.self, from: invocation.inputData)
            let output = try await handler.convertToIndependent(input: input, storage: storage)
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
