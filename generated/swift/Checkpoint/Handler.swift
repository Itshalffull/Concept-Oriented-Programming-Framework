// generated: Checkpoint/Handler.swift

import Foundation

protocol CheckpointHandler {
    func capture(
        input: CheckpointCaptureInput,
        storage: ConceptStorage
    ) async throws -> CheckpointCaptureOutput

    func restore(
        input: CheckpointRestoreInput,
        storage: ConceptStorage
    ) async throws -> CheckpointRestoreOutput

    func findLatest(
        input: CheckpointFindLatestInput,
        storage: ConceptStorage
    ) async throws -> CheckpointFindLatestOutput

    func prune(
        input: CheckpointPruneInput,
        storage: ConceptStorage
    ) async throws -> CheckpointPruneOutput

}
