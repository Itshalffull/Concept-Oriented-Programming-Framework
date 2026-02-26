// generated: AutomationRule/Adapter.swift

import Foundation

class AutomationRuleAdapter: ConceptTransport {
    private let handler: any AutomationRuleHandler
    private let storage: ConceptStorage

    init(handler: any AutomationRuleHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "define":
            let input = try decoder.decode(AutomationRuleDefineInput.self, from: invocation.inputData)
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
        case "enable":
            let input = try decoder.decode(AutomationRuleEnableInput.self, from: invocation.inputData)
            let output = try await handler.enable(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "disable":
            let input = try decoder.decode(AutomationRuleDisableInput.self, from: invocation.inputData)
            let output = try await handler.disable(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "evaluate":
            let input = try decoder.decode(AutomationRuleEvaluateInput.self, from: invocation.inputData)
            let output = try await handler.evaluate(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "execute":
            let input = try decoder.decode(AutomationRuleExecuteInput.self, from: invocation.inputData)
            let output = try await handler.execute(input: input, storage: storage)
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
