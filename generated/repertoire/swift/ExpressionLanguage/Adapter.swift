// generated: ExpressionLanguage/Adapter.swift

import Foundation

class ExpressionLanguageAdapter: ConceptTransport {
    private let handler: any ExpressionLanguageHandler
    private let storage: ConceptStorage

    init(handler: any ExpressionLanguageHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "registerLanguage":
            let input = try decoder.decode(ExpressionLanguageRegisterLanguageInput.self, from: invocation.inputData)
            let output = try await handler.registerLanguage(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "registerFunction":
            let input = try decoder.decode(ExpressionLanguageRegisterFunctionInput.self, from: invocation.inputData)
            let output = try await handler.registerFunction(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "registerOperator":
            let input = try decoder.decode(ExpressionLanguageRegisterOperatorInput.self, from: invocation.inputData)
            let output = try await handler.registerOperator(input: input, storage: storage)
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
            let input = try decoder.decode(ExpressionLanguageParseInput.self, from: invocation.inputData)
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
        case "evaluate":
            let input = try decoder.decode(ExpressionLanguageEvaluateInput.self, from: invocation.inputData)
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
        case "typeCheck":
            let input = try decoder.decode(ExpressionLanguageTypeCheckInput.self, from: invocation.inputData)
            let output = try await handler.typeCheck(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "getCompletions":
            let input = try decoder.decode(ExpressionLanguageGetCompletionsInput.self, from: invocation.inputData)
            let output = try await handler.getCompletions(input: input, storage: storage)
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
