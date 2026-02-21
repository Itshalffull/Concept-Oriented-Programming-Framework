// generated: ContentParser/Adapter.swift

import Foundation

class ContentParserAdapter: ConceptTransport {
    private let handler: any ContentParserHandler
    private let storage: ConceptStorage

    init(handler: any ContentParserHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "registerFormat":
            let input = try decoder.decode(ContentParserRegisterFormatInput.self, from: invocation.inputData)
            let output = try await handler.registerFormat(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "registerExtractor":
            let input = try decoder.decode(ContentParserRegisterExtractorInput.self, from: invocation.inputData)
            let output = try await handler.registerExtractor(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "parse":
            let input = try decoder.decode(ContentParserParseInput.self, from: invocation.inputData)
            let output = try await handler.parse(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "extractRefs":
            let input = try decoder.decode(ContentParserExtractRefsInput.self, from: invocation.inputData)
            let output = try await handler.extractRefs(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "extractTags":
            let input = try decoder.decode(ContentParserExtractTagsInput.self, from: invocation.inputData)
            let output = try await handler.extractTags(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "extractProperties":
            let input = try decoder.decode(ContentParserExtractPropertiesInput.self, from: invocation.inputData)
            let output = try await handler.extractProperties(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "serialize":
            let input = try decoder.decode(ContentParserSerializeInput.self, from: invocation.inputData)
            let output = try await handler.serialize(input: input, storage: storage)
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
