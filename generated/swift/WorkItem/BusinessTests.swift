// generated: WorkItem/BusinessTests.swift

import XCTest
@testable import Clef

final class WorkItemBusinessTests: XCTestCase {

    // MARK: - Reject transition

    func testWorkItemRejectFromCreated() async throws {
        // A work item should be rejectable after creation
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.create(
            input: WorkItemCreateInput(processId: "proc-rej", stepId: "step-rej", assignee: "user-1", title: "Review Document"),
            storage: storage
        )
        guard case .ok(let workItemId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.reject(
            input: WorkItemRejectInput(workItemId: workItemId, reason: "not my responsibility"),
            storage: storage
        )
        if case .ok = step2 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    // MARK: - Release after claim

    func testWorkItemReleaseAfterClaim() async throws {
        // Releasing a claimed work item should make it available again
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.create(
            input: WorkItemCreateInput(processId: "proc-rel", stepId: "step-rel", assignee: "group-ops", title: "Process Refund"),
            storage: storage
        )
        guard case .ok(let workItemId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let _ = try await handler.claim(
            input: WorkItemClaimInput(workItemId: workItemId, claimant: "user-5"),
            storage: storage
        )

        let step3 = try await handler.release(
            input: WorkItemReleaseInput(workItemId: workItemId),
            storage: storage
        )
        if case .ok = step3 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    // MARK: - Full lifecycle: create -> claim -> start -> complete

    func testFullWorkItemLifecycle() async throws {
        // A work item should support the full lifecycle: create, claim, start, complete
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.create(
            input: WorkItemCreateInput(processId: "proc-lifecycle", stepId: "step-lc", assignee: "team-a", title: "Verify Identity"),
            storage: storage
        )
        guard case .ok(let workItemId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.claim(
            input: WorkItemClaimInput(workItemId: workItemId, claimant: "agent-1"),
            storage: storage
        )
        if case .ok = step2 {
            // success
        } else {
            XCTFail("Expected .ok on claim, got \(step2)")
        }

        let step3 = try await handler.start(
            input: WorkItemStartInput(workItemId: workItemId),
            storage: storage
        )
        if case .ok = step3 {
            // success
        } else {
            XCTFail("Expected .ok on start, got \(step3)")
        }

        let step4 = try await handler.complete(
            input: WorkItemCompleteInput(workItemId: workItemId, output: "identity verified"),
            storage: storage
        )
        if case .ok = step4 {
            // success
        } else {
            XCTFail("Expected .ok on complete, got \(step4)")
        }
    }

    // MARK: - Delegate then complete

    func testDelegateAndComplete() async throws {
        // Delegating and then completing should work correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.create(
            input: WorkItemCreateInput(processId: "proc-del-comp", stepId: "step-dc", assignee: "user-a", title: "Sign Off"),
            storage: storage
        )
        guard case .ok(let workItemId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.delegate(
            input: WorkItemDelegateInput(workItemId: workItemId, newAssignee: "user-b"),
            storage: storage
        )
        if case .ok = step2 {
            // success
        } else {
            XCTFail("Expected .ok on delegate, got \(step2)")
        }

        let step3 = try await handler.start(
            input: WorkItemStartInput(workItemId: workItemId),
            storage: storage
        )
        if case .ok = step3 {
            // success
        } else {
            XCTFail("Expected .ok on start, got \(step3)")
        }

        let step4 = try await handler.complete(
            input: WorkItemCompleteInput(workItemId: workItemId, output: "signed by delegate"),
            storage: storage
        )
        if case .ok = step4 {
            // success
        } else {
            XCTFail("Expected .ok on complete, got \(step4)")
        }
    }

    // MARK: - Multiple work items isolation

    func testMultipleWorkItemsAreIndependent() async throws {
        // Multiple work items should be independent of each other
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let r1 = try await handler.create(
            input: WorkItemCreateInput(processId: "proc-iso", stepId: "step-1", assignee: "user-1", title: "Task A"),
            storage: storage
        )
        guard case .ok(let wiA) = r1 else { XCTFail("Expected .ok"); return }

        let r2 = try await handler.create(
            input: WorkItemCreateInput(processId: "proc-iso", stepId: "step-2", assignee: "user-2", title: "Task B"),
            storage: storage
        )
        guard case .ok(let wiB) = r2 else { XCTFail("Expected .ok"); return }

        XCTAssertNotEqual(wiA, wiB)

        // Complete A, reject B - they should not interfere
        let _ = try await handler.start(input: WorkItemStartInput(workItemId: wiA), storage: storage)
        let _ = try await handler.complete(input: WorkItemCompleteInput(workItemId: wiA, output: "done"), storage: storage)
        let _ = try await handler.reject(input: WorkItemRejectInput(workItemId: wiB, reason: "wrong assignment"), storage: storage)
    }

    // MARK: - Multiple delegations

    func testMultipleDelegations() async throws {
        // A work item should support being delegated multiple times
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.create(
            input: WorkItemCreateInput(processId: "proc-multi-del", stepId: "step-md", assignee: "user-1", title: "Escalated Review"),
            storage: storage
        )
        guard case .ok(let workItemId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let d1 = try await handler.delegate(
            input: WorkItemDelegateInput(workItemId: workItemId, newAssignee: "user-2"),
            storage: storage
        )
        if case .ok = d1 {
            // success
        } else {
            XCTFail("Expected .ok, got \(d1)")
        }

        let d2 = try await handler.delegate(
            input: WorkItemDelegateInput(workItemId: workItemId, newAssignee: "user-3"),
            storage: storage
        )
        if case .ok = d2 {
            // success
        } else {
            XCTFail("Expected .ok, got \(d2)")
        }

        let d3 = try await handler.delegate(
            input: WorkItemDelegateInput(workItemId: workItemId, newAssignee: "user-4"),
            storage: storage
        )
        if case .ok = d3 {
            // success
        } else {
            XCTFail("Expected .ok, got \(d3)")
        }
    }

    // MARK: - Claim then release then re-claim

    func testClaimReleaseThenReClaim() async throws {
        // A work item should be re-claimable after release
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.create(
            input: WorkItemCreateInput(processId: "proc-reclaim", stepId: "step-rc", assignee: "group-1", title: "Re-claimable Task"),
            storage: storage
        )
        guard case .ok(let workItemId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let _ = try await handler.claim(
            input: WorkItemClaimInput(workItemId: workItemId, claimant: "agent-a"),
            storage: storage
        )
        let _ = try await handler.release(
            input: WorkItemReleaseInput(workItemId: workItemId),
            storage: storage
        )

        let step4 = try await handler.claim(
            input: WorkItemClaimInput(workItemId: workItemId, claimant: "agent-b"),
            storage: storage
        )
        if case .ok = step4 {
            // success
        } else {
            XCTFail("Expected .ok on re-claim, got \(step4)")
        }
    }

    // MARK: - Unique work item IDs

    func testEachCreateReturnsUniqueWorkItemId() async throws {
        // Each create call should produce a unique work item ID
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        var ids: Set<String> = []
        for i in 1...6 {
            let result = try await handler.create(
                input: WorkItemCreateInput(processId: "proc-uniq-wi", stepId: "step-\(i)", assignee: "user-\(i)", title: "Task \(i)"),
                storage: storage
            )
            guard case .ok(let id) = result else {
                XCTFail("Expected .ok, got \(result)")
                return
            }
            ids.insert(id)
        }
        XCTAssertEqual(ids.count, 6, "All 6 work item IDs should be unique")
    }

}
