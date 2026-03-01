// generated: Approval/ConformanceTests.swift

import XCTest
@testable import Clef

final class ApprovalConformanceTests: XCTestCase {

    func testApprovalRequestAndApprove() async throws {
        // invariant: after request then approve, getStatus returns "approved"
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        // --- AFTER clause ---
        let step1 = try await handler.request(
            input: ApprovalRequestInput(processId: "proc-1", stepId: "step-1", approver: "mgr-1", subject: "Budget Request"),
            storage: storage
        )
        guard case .ok(let approvalId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.approve(
            input: ApprovalApproveInput(approvalId: approvalId, comment: "Looks good"),
            storage: storage
        )
        if case .ok = step2 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        // --- THEN clause ---
        let step3 = try await handler.getStatus(
            input: ApprovalGetStatusInput(approvalId: approvalId),
            storage: storage
        )
        if case .ok(_, let status, _) = step3 {
            XCTAssertEqual(status, "approved")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    func testApprovalRequestAndDeny() async throws {
        // invariant: after request then deny, getStatus returns "denied"
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let step1 = try await handler.request(
            input: ApprovalRequestInput(processId: "proc-2", stepId: "step-2", approver: "mgr-2", subject: "Access Request"),
            storage: storage
        )
        guard case .ok(let approvalId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.deny(
            input: ApprovalDenyInput(approvalId: approvalId, reason: "Insufficient justification"),
            storage: storage
        )
        if case .ok = step2 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        let step3 = try await handler.getStatus(
            input: ApprovalGetStatusInput(approvalId: approvalId),
            storage: storage
        )
        if case .ok(_, let status, _) = step3 {
            XCTAssertEqual(status, "denied")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    func testApprovalRequestChanges() async throws {
        // invariant: after requestChanges, getStatus returns "changesRequested"
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let step1 = try await handler.request(
            input: ApprovalRequestInput(processId: "proc-3", stepId: "step-3", approver: "mgr-3", subject: "Design Review"),
            storage: storage
        )
        guard case .ok(let approvalId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.requestChanges(
            input: ApprovalRequestChangesInput(approvalId: approvalId, feedback: "Needs more detail"),
            storage: storage
        )
        if case .ok = step2 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        let step3 = try await handler.getStatus(
            input: ApprovalGetStatusInput(approvalId: approvalId),
            storage: storage
        )
        if case .ok(_, let status, _) = step3 {
            XCTAssertEqual(status, "changesRequested")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
