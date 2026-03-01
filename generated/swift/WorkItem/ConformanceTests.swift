// generated: WorkItem/ConformanceTests.swift

import XCTest
@testable import Clef

final class WorkItemConformanceTests: XCTestCase {

    func testWorkItemCreateAndClaim() async throws {
        // invariant: after create, claim transitions the work item to claimed state
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        // --- AFTER clause ---
        let step1 = try await handler.create(
            input: WorkItemCreateInput(processId: "proc-1", stepId: "step-1", assignee: "group-a", title: "Review Order"),
            storage: storage
        )
        guard case .ok(let workItemId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }
        XCTAssertFalse(workItemId.isEmpty)

        // --- THEN clause ---
        let step2 = try await handler.claim(
            input: WorkItemClaimInput(workItemId: workItemId, claimant: "user-1"),
            storage: storage
        )
        if case .ok = step2 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testWorkItemStartAndComplete() async throws {
        // invariant: after start, complete transitions the work item to completed state
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let step1 = try await handler.create(
            input: WorkItemCreateInput(processId: "proc-2", stepId: "step-2", assignee: "user-2", title: "Approve Invoice"),
            storage: storage
        )
        guard case .ok(let workItemId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.start(
            input: WorkItemStartInput(workItemId: workItemId),
            storage: storage
        )
        if case .ok = step2 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        let step3 = try await handler.complete(
            input: WorkItemCompleteInput(workItemId: workItemId, output: "approved"),
            storage: storage
        )
        if case .ok = step3 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    func testWorkItemDelegate() async throws {
        // invariant: after delegate, the work item is reassigned
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let step1 = try await handler.create(
            input: WorkItemCreateInput(processId: "proc-3", stepId: "step-3", assignee: "user-3", title: "Sign Contract"),
            storage: storage
        )
        guard case .ok(let workItemId) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.delegate(
            input: WorkItemDelegateInput(workItemId: workItemId, newAssignee: "user-4"),
            storage: storage
        )
        if case .ok = step2 {
            // success
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
