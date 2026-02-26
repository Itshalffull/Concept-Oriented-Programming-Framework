// generated: Group/Handler.swift

import Foundation

protocol GroupHandler {
    func createGroup(
        input: GroupCreateGroupInput,
        storage: ConceptStorage
    ) async throws -> GroupCreateGroupOutput

    func addMember(
        input: GroupAddMemberInput,
        storage: ConceptStorage
    ) async throws -> GroupAddMemberOutput

    func assignGroupRole(
        input: GroupAssignGroupRoleInput,
        storage: ConceptStorage
    ) async throws -> GroupAssignGroupRoleOutput

    func addContent(
        input: GroupAddContentInput,
        storage: ConceptStorage
    ) async throws -> GroupAddContentOutput

    func checkGroupAccess(
        input: GroupCheckGroupAccessInput,
        storage: ConceptStorage
    ) async throws -> GroupCheckGroupAccessOutput

}
