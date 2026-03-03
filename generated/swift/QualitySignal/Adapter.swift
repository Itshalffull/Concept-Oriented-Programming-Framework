// generated: QualitySignal/Adapter.swift

import Foundation

class QualitySignalAdapter: ConceptTransport {
    private let handler: any QualitySignalHandler
    private let storage: ConceptStorage

    init(handler: any QualitySignalHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "record":
            let input = try decoder.decode(QualitySignalRecordInput.self, from: invocation.inputData)
            let output = try await handler.record(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "latest":
            let input = try decoder.decode(QualitySignalLatestInput.self, from: invocation.inputData)
            let output = try await handler.latest(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "rollup":
            let input = try decoder.decode(QualitySignalRollupInput.self, from: invocation.inputData)
            let output = try await handler.rollup(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "explain":
            let input = try decoder.decode(QualitySignalExplainInput.self, from: invocation.inputData)
            let output = try await handler.explain(input: input, storage: storage)
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