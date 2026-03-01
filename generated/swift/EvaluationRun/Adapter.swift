// generated: EvaluationRun/Adapter.swift

import Foundation

class EvaluationRunAdapter: ConceptTransport {
    private let handler: any EvaluationRunHandler
    private let storage: ConceptStorage

    init(handler: any EvaluationRunHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "runEval":
            let input = try decoder.decode(EvaluationRunRunEvalInput.self, from: invocation.inputData)
            let output = try await handler.runEval(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "logMetric":
            let input = try decoder.decode(EvaluationRunLogMetricInput.self, from: invocation.inputData)
            let output = try await handler.logMetric(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "pass":
            let input = try decoder.decode(EvaluationRunPassInput.self, from: invocation.inputData)
            let output = try await handler.pass(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "fail":
            let input = try decoder.decode(EvaluationRunFailInput.self, from: invocation.inputData)
            let output = try await handler.fail(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "getResult":
            let input = try decoder.decode(EvaluationRunGetResultInput.self, from: invocation.inputData)
            let output = try await handler.getResult(input: input, storage: storage)
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
