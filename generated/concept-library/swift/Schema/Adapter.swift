// generated: Schema/Adapter.swift

import Foundation

class SchemaAdapter: ConceptTransport {
    private let handler: any SchemaHandler
    private let storage: ConceptStorage

    init(handler: any SchemaHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "defineSchema":
            let input = try decoder.decode(SchemaDefineSchemaInput.self, from: invocation.inputData)
            let output = try await handler.defineSchema(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "addField":
            let input = try decoder.decode(SchemaAddFieldInput.self, from: invocation.inputData)
            let output = try await handler.addField(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "extendSchema":
            let input = try decoder.decode(SchemaExtendSchemaInput.self, from: invocation.inputData)
            let output = try await handler.extendSchema(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "applyTo":
            let input = try decoder.decode(SchemaApplyToInput.self, from: invocation.inputData)
            let output = try await handler.applyTo(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "removeFrom":
            let input = try decoder.decode(SchemaRemoveFromInput.self, from: invocation.inputData)
            let output = try await handler.removeFrom(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "getAssociations":
            let input = try decoder.decode(SchemaGetAssociationsInput.self, from: invocation.inputData)
            let output = try await handler.getAssociations(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "export":
            let input = try decoder.decode(SchemaExportInput.self, from: invocation.inputData)
            let output = try await handler.export(input: input, storage: storage)
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
