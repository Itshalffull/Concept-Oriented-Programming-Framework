// generated: Queue/Handler.swift

import Foundation

protocol QueueHandler {
    func enqueue(
        input: QueueEnqueueInput,
        storage: ConceptStorage
    ) async throws -> QueueEnqueueOutput

    func claim(
        input: QueueClaimInput,
        storage: ConceptStorage
    ) async throws -> QueueClaimOutput

    func process(
        input: QueueProcessInput,
        storage: ConceptStorage
    ) async throws -> QueueProcessOutput

    func release(
        input: QueueReleaseInput,
        storage: ConceptStorage
    ) async throws -> QueueReleaseOutput

    func delete(
        input: QueueDeleteInput,
        storage: ConceptStorage
    ) async throws -> QueueDeleteOutput

}
