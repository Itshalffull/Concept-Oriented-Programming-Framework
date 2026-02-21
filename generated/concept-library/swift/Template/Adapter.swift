// generated: Template/Adapter.swift

import Foundation

class TemplateAdapter: ConceptTransport {
    private let handler: any TemplateHandler
    private let storage: ConceptStorage

    init(handler: any TemplateHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "define":
            let input = try decoder.decode(TemplateDefineInput.self, from: invocation.inputData)
            let output = try await handler.define(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "instantiate":
            let input = try decoder.decode(TemplateInstantiateInput.self, from: invocation.inputData)
            let output = try await handler.instantiate(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "registerTrigger":
            let input = try decoder.decode(TemplateRegisterTriggerInput.self, from: invocation.inputData)
            let output = try await handler.registerTrigger(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "mergeProperties":
            let input = try decoder.decode(TemplateMergePropertiesInput.self, from: invocation.inputData)
            let output = try await handler.mergeProperties(input: input, storage: storage)
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
