// generated: PageAsRecord/Adapter.swift

import Foundation

class PageAsRecordAdapter: ConceptTransport {
    private let handler: any PageAsRecordHandler
    private let storage: ConceptStorage

    init(handler: any PageAsRecordHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "create":
            let input = try decoder.decode(PageAsRecordCreateInput.self, from: invocation.inputData)
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
        case "setProperty":
            let input = try decoder.decode(PageAsRecordSetPropertyInput.self, from: invocation.inputData)
            let output = try await handler.setProperty(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "getProperty":
            let input = try decoder.decode(PageAsRecordGetPropertyInput.self, from: invocation.inputData)
            let output = try await handler.getProperty(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "appendToBody":
            let input = try decoder.decode(PageAsRecordAppendToBodyInput.self, from: invocation.inputData)
            let output = try await handler.appendToBody(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "attachToSchema":
            let input = try decoder.decode(PageAsRecordAttachToSchemaInput.self, from: invocation.inputData)
            let output = try await handler.attachToSchema(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "convertFromFreeform":
            let input = try decoder.decode(PageAsRecordConvertFromFreeformInput.self, from: invocation.inputData)
            let output = try await handler.convertFromFreeform(input: input, storage: storage)
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
