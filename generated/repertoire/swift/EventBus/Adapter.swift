// generated: EventBus/Adapter.swift

import Foundation

class EventBusAdapter: ConceptTransport {
    private let handler: any EventBusHandler
    private let storage: ConceptStorage

    init(handler: any EventBusHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "registerEventType":
            let input = try decoder.decode(EventBusRegisterEventTypeInput.self, from: invocation.inputData)
            let output = try await handler.registerEventType(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "subscribe":
            let input = try decoder.decode(EventBusSubscribeInput.self, from: invocation.inputData)
            let output = try await handler.subscribe(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "unsubscribe":
            let input = try decoder.decode(EventBusUnsubscribeInput.self, from: invocation.inputData)
            let output = try await handler.unsubscribe(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "dispatch":
            let input = try decoder.decode(EventBusDispatchInput.self, from: invocation.inputData)
            let output = try await handler.dispatch(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "dispatchAsync":
            let input = try decoder.decode(EventBusDispatchAsyncInput.self, from: invocation.inputData)
            let output = try await handler.dispatchAsync(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "getHistory":
            let input = try decoder.decode(EventBusGetHistoryInput.self, from: invocation.inputData)
            let output = try await handler.getHistory(input: input, storage: storage)
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
