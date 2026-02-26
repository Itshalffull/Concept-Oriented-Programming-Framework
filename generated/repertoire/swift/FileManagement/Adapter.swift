// generated: FileManagement/Adapter.swift

import Foundation

class FileManagementAdapter: ConceptTransport {
    private let handler: any FileManagementHandler
    private let storage: ConceptStorage

    init(handler: any FileManagementHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "upload":
            let input = try decoder.decode(FileManagementUploadInput.self, from: invocation.inputData)
            let output = try await handler.upload(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "addUsage":
            let input = try decoder.decode(FileManagementAddUsageInput.self, from: invocation.inputData)
            let output = try await handler.addUsage(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "removeUsage":
            let input = try decoder.decode(FileManagementRemoveUsageInput.self, from: invocation.inputData)
            let output = try await handler.removeUsage(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "garbageCollect":
            let input = try decoder.decode(FileManagementGarbageCollectInput.self, from: invocation.inputData)
            let output = try await handler.garbageCollect(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "getFile":
            let input = try decoder.decode(FileManagementGetFileInput.self, from: invocation.inputData)
            let output = try await handler.getFile(input: input, storage: storage)
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
