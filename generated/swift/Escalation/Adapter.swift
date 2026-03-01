// generated: Escalation/Adapter.swift

import Foundation

class EscalationAdapter: ConceptTransport {
    private let handler: any EscalationHandler
    private let storage: ConceptStorage

    init(handler: any EscalationHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "escalate":
            let input = try decoder.decode(EscalationEscalateInput.self, from: invocation.inputData)
            let output = try await handler.escalate(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "accept":
            let input = try decoder.decode(EscalationAcceptInput.self, from: invocation.inputData)
            let output = try await handler.accept(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "resolve":
            let input = try decoder.decode(EscalationResolveInput.self, from: invocation.inputData)
            let output = try await handler.resolve(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "reEscalate":
            let input = try decoder.decode(EscalationReEscalateInput.self, from: invocation.inputData)
            let output = try await handler.reEscalate(input: input, storage: storage)
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
