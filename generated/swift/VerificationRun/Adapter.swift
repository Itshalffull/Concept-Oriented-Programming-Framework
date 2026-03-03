// generated: VerificationRun/Adapter.swift

import Foundation

class VerificationRunAdapter: ConceptTransport {
    private let handler: any VerificationRunHandler
    private let storage: ConceptStorage

    init(handler: any VerificationRunHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "start":
            let input = try decoder.decode(VerificationRunStartInput.self, from: invocation.inputData)
            let output = try await handler.start(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "complete":
            let input = try decoder.decode(VerificationRunCompleteInput.self, from: invocation.inputData)
            let output = try await handler.complete(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "timeout":
            let input = try decoder.decode(VerificationRunTimeoutInput.self, from: invocation.inputData)
            let output = try await handler.timeout(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "cancel":
            let input = try decoder.decode(VerificationRunCancelInput.self, from: invocation.inputData)
            let output = try await handler.cancel(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "get_status":
            let input = try decoder.decode(VerificationRunGet_statusInput.self, from: invocation.inputData)
            let output = try await handler.get_status(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "compare":
            let input = try decoder.decode(VerificationRunCompareInput.self, from: invocation.inputData)
            let output = try await handler.compare(input: input, storage: storage)
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