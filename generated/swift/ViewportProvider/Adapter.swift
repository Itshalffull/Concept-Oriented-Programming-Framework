// generated: ViewportProvider/Adapter.swift

import Foundation

class ViewportProviderAdapter: ConceptTransport {
    private let handler: any ViewportProviderHandler
    private let storage: ConceptStorage

    init(handler: any ViewportProviderHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "initialize":
            let input = try decoder.decode(ViewportProviderInitializeInput.self, from: invocation.inputData)
            let output = try await handler.initialize(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "observe":
            let input = try decoder.decode(ViewportProviderObserveInput.self, from: invocation.inputData)
            let output = try await handler.observe(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "getBreakpoint":
            let input = try decoder.decode(ViewportProviderGetBreakpointInput.self, from: invocation.inputData)
            let output = try await handler.getBreakpoint(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "setBreakpoints":
            let input = try decoder.decode(ViewportProviderSetBreakpointsInput.self, from: invocation.inputData)
            let output = try await handler.setBreakpoints(input: input, storage: storage)
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
