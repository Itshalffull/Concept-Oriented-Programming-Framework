// generated: Collection/Handler.swift

import Foundation

protocol CollectionHandler {
    func create(
        input: CollectionCreateInput,
        storage: ConceptStorage
    ) async throws -> CollectionCreateOutput

    func addMember(
        input: CollectionAddMemberInput,
        storage: ConceptStorage
    ) async throws -> CollectionAddMemberOutput

    func removeMember(
        input: CollectionRemoveMemberInput,
        storage: ConceptStorage
    ) async throws -> CollectionRemoveMemberOutput

    func getMembers(
        input: CollectionGetMembersInput,
        storage: ConceptStorage
    ) async throws -> CollectionGetMembersOutput

    func setSchema(
        input: CollectionSetSchemaInput,
        storage: ConceptStorage
    ) async throws -> CollectionSetSchemaOutput

    func createVirtual(
        input: CollectionCreateVirtualInput,
        storage: ConceptStorage
    ) async throws -> CollectionCreateVirtualOutput

    func materialize(
        input: CollectionMaterializeInput,
        storage: ConceptStorage
    ) async throws -> CollectionMaterializeOutput

}
