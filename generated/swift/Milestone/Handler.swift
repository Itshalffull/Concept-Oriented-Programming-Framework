// generated: Milestone/Handler.swift

import Foundation

protocol MilestoneHandler {
    func define(
        input: MilestoneDefineInput,
        storage: ConceptStorage
    ) async throws -> MilestoneDefineOutput

    func evaluate(
        input: MilestoneEvaluateInput,
        storage: ConceptStorage
    ) async throws -> MilestoneEvaluateOutput

    func revoke(
        input: MilestoneRevokeInput,
        storage: ConceptStorage
    ) async throws -> MilestoneRevokeOutput

}
