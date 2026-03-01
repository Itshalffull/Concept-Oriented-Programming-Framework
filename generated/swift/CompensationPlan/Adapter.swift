// generated: CompensationPlan/Adapter.swift

import Foundation

class CompensationPlanAdapter: ConceptTransport {
    private let handler: any CompensationPlanHandler
    private let storage: ConceptStorage

    init(handler: any CompensationPlanHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "register":
            let input = try decoder.decode(CompensationPlanRegisterInput.self, from: invocation.inputData)
            let output = try await handler.register(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "trigger":
            let input = try decoder.decode(CompensationPlanTriggerInput.self, from: invocation.inputData)
            let output = try await handler.trigger(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "executeNext":
            let input = try decoder.decode(CompensationPlanExecuteNextInput.self, from: invocation.inputData)
            let output = try await handler.executeNext(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "markCompensationFailed":
            let input = try decoder.decode(CompensationPlanMarkCompensationFailedInput.self, from: invocation.inputData)
            let output = try await handler.markCompensationFailed(input: input, storage: storage)
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
