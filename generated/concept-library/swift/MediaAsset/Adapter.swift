// generated: MediaAsset/Adapter.swift

import Foundation

class MediaAssetAdapter: ConceptTransport {
    private let handler: any MediaAssetHandler
    private let storage: ConceptStorage

    init(handler: any MediaAssetHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "createMedia":
            let input = try decoder.decode(MediaAssetCreateMediaInput.self, from: invocation.inputData)
            let output = try await handler.createMedia(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "extractMetadata":
            let input = try decoder.decode(MediaAssetExtractMetadataInput.self, from: invocation.inputData)
            let output = try await handler.extractMetadata(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "generateThumbnail":
            let input = try decoder.decode(MediaAssetGenerateThumbnailInput.self, from: invocation.inputData)
            let output = try await handler.generateThumbnail(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "getMedia":
            let input = try decoder.decode(MediaAssetGetMediaInput.self, from: invocation.inputData)
            let output = try await handler.getMedia(input: input, storage: storage)
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
