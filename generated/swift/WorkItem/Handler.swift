// generated: WorkItem/Handler.swift

import Foundation

protocol WorkItemHandler {
    func create(
        input: WorkItemCreateInput,
        storage: ConceptStorage
    ) async throws -> WorkItemCreateOutput

    func claim(
        input: WorkItemClaimInput,
        storage: ConceptStorage
    ) async throws -> WorkItemClaimOutput

    func start(
        input: WorkItemStartInput,
        storage: ConceptStorage
    ) async throws -> WorkItemStartOutput

    func complete(
        input: WorkItemCompleteInput,
        storage: ConceptStorage
    ) async throws -> WorkItemCompleteOutput

    func reject(
        input: WorkItemRejectInput,
        storage: ConceptStorage
    ) async throws -> WorkItemRejectOutput

    func delegate(
        input: WorkItemDelegateInput,
        storage: ConceptStorage
    ) async throws -> WorkItemDelegateOutput

    func release(
        input: WorkItemReleaseInput,
        storage: ConceptStorage
    ) async throws -> WorkItemReleaseOutput

}
