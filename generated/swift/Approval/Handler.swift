// generated: Approval/Handler.swift

import Foundation

protocol ApprovalHandler {
    func request(
        input: ApprovalRequestInput,
        storage: ConceptStorage
    ) async throws -> ApprovalRequestOutput

    func approve(
        input: ApprovalApproveInput,
        storage: ConceptStorage
    ) async throws -> ApprovalApproveOutput

    func deny(
        input: ApprovalDenyInput,
        storage: ConceptStorage
    ) async throws -> ApprovalDenyOutput

    func requestChanges(
        input: ApprovalRequestChangesInput,
        storage: ConceptStorage
    ) async throws -> ApprovalRequestChangesOutput

    func timeout(
        input: ApprovalTimeoutInput,
        storage: ConceptStorage
    ) async throws -> ApprovalTimeoutOutput

    func getStatus(
        input: ApprovalGetStatusInput,
        storage: ConceptStorage
    ) async throws -> ApprovalGetStatusOutput

}
