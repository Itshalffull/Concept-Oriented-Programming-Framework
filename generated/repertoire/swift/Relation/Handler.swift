// generated: Relation/Handler.swift

import Foundation

protocol RelationHandler {
    func defineRelation(
        input: RelationDefineRelationInput,
        storage: ConceptStorage
    ) async throws -> RelationDefineRelationOutput

    func link(
        input: RelationLinkInput,
        storage: ConceptStorage
    ) async throws -> RelationLinkOutput

    func unlink(
        input: RelationUnlinkInput,
        storage: ConceptStorage
    ) async throws -> RelationUnlinkOutput

    func getRelated(
        input: RelationGetRelatedInput,
        storage: ConceptStorage
    ) async throws -> RelationGetRelatedOutput

    func defineRollup(
        input: RelationDefineRollupInput,
        storage: ConceptStorage
    ) async throws -> RelationDefineRollupOutput

    func computeRollup(
        input: RelationComputeRollupInput,
        storage: ConceptStorage
    ) async throws -> RelationComputeRollupOutput

}
