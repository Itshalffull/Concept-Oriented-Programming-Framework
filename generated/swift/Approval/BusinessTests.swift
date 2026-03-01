// generated: Approval/BusinessTests.swift

import XCTest
@testable import Clef

final class ApprovalBusinessTests: XCTestCase {

    // MARK: - Timeout transition

    func testApprovalTimeoutSetsTimedOutStatus() async throws {
        // After requesting and timing out, getStatus should return "timedOut"
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.request(
            input: ApprovalRequestInput(processId: "proc-timeout", stepId: "step-to", approver: "mgr-1", subject: "Expense Report"),
            storage: storage
        )
        guard case .ok(let approvalId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.timeout(
            input: ApprovalTimeoutInput(approvalId: approvalId),
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
            XCTAssertEqual(status, "timedOut")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    // MARK: - Request changes then re-approve

    func testRequestChangesThenApprove() async throws {
        // After requestChanges, a subsequent approve should update status to "approved"
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.request(
            input: ApprovalRequestInput(processId: "proc-rc-approve", stepId: "step-rca", approver: "mgr-2", subject: "Contract Review"),
            storage: storage
        )
        guard case .ok(let approvalId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let _ = try await handler.requestChanges(
            input: ApprovalRequestChangesInput(approvalId: approvalId, feedback: "Update section 3"),
            storage: storage
        )

        let step3 = try await handler.approve(
            input: ApprovalApproveInput(approvalId: approvalId, comment: "Changes look good now"),
            storage: storage
        )
        if case .ok = step3 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }

        let step4 = try await handler.getStatus(
            input: ApprovalGetStatusInput(approvalId: approvalId),
            storage: storage
        )
        if case .ok(_, let status, _) = step4 {
            XCTAssertEqual(status, "approved")
        } else {
            XCTFail("Expected .ok, got \(step4)")
        }
    }

    // MARK: - Request changes then deny

    func testRequestChangesThenDeny() async throws {
        // After requestChanges, a deny should update status to "denied"
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.request(
            input: ApprovalRequestInput(processId: "proc-rc-deny", stepId: "step-rcd", approver: "mgr-3", subject: "Budget Override"),
            storage: storage
        )
        guard case .ok(let approvalId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let _ = try await handler.requestChanges(
            input: ApprovalRequestChangesInput(approvalId: approvalId, feedback: "Justification insufficient"),
            storage: storage
        )

        let step3 = try await handler.deny(
            input: ApprovalDenyInput(approvalId: approvalId, reason: "Cannot approve without proper justification"),
            storage: storage
        )
        if case .ok = step3 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }

        let step4 = try await handler.getStatus(
            input: ApprovalGetStatusInput(approvalId: approvalId),
            storage: storage
        )
        if case .ok(_, let status, _) = step4 {
            XCTAssertEqual(status, "denied")
        } else {
            XCTFail("Expected .ok, got \(step4)")
        }
    }

    // MARK: - Multiple approvals isolation

    func testMultipleApprovalsAreIsolated() async throws {
        // Approving one request should not affect another
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let r1 = try await handler.request(
            input: ApprovalRequestInput(processId: "proc-iso-1", stepId: "s1", approver: "mgr-a", subject: "Request A"),
            storage: storage
        )
        guard case .ok(let approvalA) = r1 else { XCTFail("Expected .ok"); return }

        let r2 = try await handler.request(
            input: ApprovalRequestInput(processId: "proc-iso-2", stepId: "s2", approver: "mgr-b", subject: "Request B"),
            storage: storage
        )
        guard case .ok(let approvalB) = r2 else { XCTFail("Expected .ok"); return }

        // Approve A, deny B
        let _ = try await handler.approve(
            input: ApprovalApproveInput(approvalId: approvalA, comment: "Approved"),
            storage: storage
        )
        let _ = try await handler.deny(
            input: ApprovalDenyInput(approvalId: approvalB, reason: "Denied"),
            storage: storage
        )

        let statusA = try await handler.getStatus(
            input: ApprovalGetStatusInput(approvalId: approvalA),
            storage: storage
        )
        if case .ok(_, let status, _) = statusA {
            XCTAssertEqual(status, "approved")
        } else {
            XCTFail("Expected .ok, got \(statusA)")
        }

        let statusB = try await handler.getStatus(
            input: ApprovalGetStatusInput(approvalId: approvalB),
            storage: storage
        )
        if case .ok(_, let status, _) = statusB {
            XCTAssertEqual(status, "denied")
        } else {
            XCTFail("Expected .ok, got \(statusB)")
        }
    }

    // MARK: - Pending status before action

    func testPendingStatusBeforeAnyAction() async throws {
        // A newly requested approval should have "pending" status
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.request(
            input: ApprovalRequestInput(processId: "proc-pending", stepId: "step-p", approver: "mgr-p", subject: "Pending Check"),
            storage: storage
        )
        guard case .ok(let approvalId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.getStatus(
            input: ApprovalGetStatusInput(approvalId: approvalId),
            storage: storage
        )
        if case .ok(_, let status, _) = step2 {
            XCTAssertEqual(status, "pending")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    // MARK: - Unique approval IDs

    func testEachRequestReturnsUniqueApprovalId() async throws {
        // Each request call should produce a unique approval ID
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        var ids: Set<String> = []
        for i in 1...5 {
            let result = try await handler.request(
                input: ApprovalRequestInput(processId: "proc-\(i)", stepId: "step-\(i)", approver: "mgr-\(i)", subject: "Subject \(i)"),
                storage: storage
            )
            guard case .ok(let id) = result else {
                XCTFail("Expected .ok, got \(result)")
                return
            }
            ids.insert(id)
        }
        XCTAssertEqual(ids.count, 5, "All 5 approval IDs should be unique")
    }

    // MARK: - Multiple request-changes cycles

    func testMultipleRequestChangesCycles() async throws {
        // An approval should support multiple rounds of requestChanges
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.request(
            input: ApprovalRequestInput(processId: "proc-multi-rc", stepId: "step-mrc", approver: "mgr-mrc", subject: "Iterative Review"),
            storage: storage
        )
        guard case .ok(let approvalId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        for i in 1...3 {
            let rc = try await handler.requestChanges(
                input: ApprovalRequestChangesInput(approvalId: approvalId, feedback: "Round \(i) feedback"),
                storage: storage
            )
            if case .ok = rc {
                // success
            } else {
                XCTFail("Expected .ok on round \(i), got \(rc)")
            }

            let status = try await handler.getStatus(
                input: ApprovalGetStatusInput(approvalId: approvalId),
                storage: storage
            )
            if case .ok(_, let s, _) = status {
                XCTAssertEqual(s, "changesRequested")
            } else {
                XCTFail("Expected .ok, got \(status)")
            }
        }

        // Finally approve
        let _ = try await handler.approve(
            input: ApprovalApproveInput(approvalId: approvalId, comment: "All changes addressed"),
            storage: storage
        )

        let finalStatus = try await handler.getStatus(
            input: ApprovalGetStatusInput(approvalId: approvalId),
            storage: storage
        )
        if case .ok(_, let status, _) = finalStatus {
            XCTAssertEqual(status, "approved")
        } else {
            XCTFail("Expected .ok, got \(finalStatus)")
        }
    }

    // MARK: - Same step different processes

    func testSameStepDifferentProcesses() async throws {
        // Approvals for the same step in different processes should be independent
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let r1 = try await handler.request(
            input: ApprovalRequestInput(processId: "proc-1", stepId: "step-shared", approver: "mgr-shared", subject: "Shared Step Approval 1"),
            storage: storage
        )
        guard case .ok(let id1) = r1 else { XCTFail("Expected .ok"); return }

        let r2 = try await handler.request(
            input: ApprovalRequestInput(processId: "proc-2", stepId: "step-shared", approver: "mgr-shared", subject: "Shared Step Approval 2"),
            storage: storage
        )
        guard case .ok(let id2) = r2 else { XCTFail("Expected .ok"); return }

        XCTAssertNotEqual(id1, id2)
    }

}
