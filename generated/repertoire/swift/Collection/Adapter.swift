// generated: Collection/Adapter.swift

import Foundation

class CollectionAdapter: ConceptTransport {
    private let handler: any CollectionHandler
    private let storage: ConceptStorage

    init(handler: any CollectionHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "create":
            let input = try decoder.decode(CollectionCreateInput.self, from: invocation.inputData)
            let output = try await handler.create(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "addMember":
            let input = try decoder.decode(CollectionAddMemberInput.self, from: invocation.inputData)
            let output = try await handler.addMember(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "removeMember":
            let input = try decoder.decode(CollectionRemoveMemberInput.self, from: invocation.inputData)
            let output = try await handler.removeMember(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "getMembers":
            let input = try decoder.decode(CollectionGetMembersInput.self, from: invocation.inputData)
            let output = try await handler.getMembers(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "setSchema":
            let input = try decoder.decode(CollectionSetSchemaInput.self, from: invocation.inputData)
            let output = try await handler.setSchema(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "createVirtual":
            let input = try decoder.decode(CollectionCreateVirtualInput.self, from: invocation.inputData)
            let output = try await handler.createVirtual(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "materialize":
            let input = try decoder.decode(CollectionMaterializeInput.self, from: invocation.inputData)
            let output = try await handler.materialize(input: input, storage: storage)
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
