// generated: EventBus/Handler.swift

import Foundation

protocol EventBusHandler {
    func registerEventType(
        input: EventBusRegisterEventTypeInput,
        storage: ConceptStorage
    ) async throws -> EventBusRegisterEventTypeOutput

    func subscribe(
        input: EventBusSubscribeInput,
        storage: ConceptStorage
    ) async throws -> EventBusSubscribeOutput

    func unsubscribe(
        input: EventBusUnsubscribeInput,
        storage: ConceptStorage
    ) async throws -> EventBusUnsubscribeOutput

    func dispatch(
        input: EventBusDispatchInput,
        storage: ConceptStorage
    ) async throws -> EventBusDispatchOutput

    func dispatchAsync(
        input: EventBusDispatchAsyncInput,
        storage: ConceptStorage
    ) async throws -> EventBusDispatchAsyncOutput

    func getHistory(
        input: EventBusGetHistoryInput,
        storage: ConceptStorage
    ) async throws -> EventBusGetHistoryOutput

}
