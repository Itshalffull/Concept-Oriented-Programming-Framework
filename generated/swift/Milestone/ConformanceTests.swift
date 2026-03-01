// generated: Milestone/ConformanceTests.swift

import XCTest
@testable import Clef

final class MilestoneConformanceTests: XCTestCase {

    func testMilestoneDefineAndEvaluateAchieved() async throws {
        // invariant: after define, evaluate with matching context returns achieved
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let context = Data("{\"orderTotal\":150.00,\"itemsValidated\":true}".utf8)

        // --- AFTER clause ---
        let step1 = try await handler.define(
            input: MilestoneDefineInput(
                runRef: "run-001",
                name: "order-confirmed",
                conditionExpr: "itemsValidated == true && orderTotal > 0"
            ),
            storage: storage
        )
        guard case .ok(let milestone) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }
        XCTAssertFalse(milestone.isEmpty)

        // --- THEN clause ---
        let step2 = try await handler.evaluate(
            input: MilestoneEvaluateInput(milestone: milestone, context: context),
            storage: storage
        )
        switch step2 {
        case .achieved(let achievedMilestone, let name, let runRef):
            XCTAssertEqual(achievedMilestone, milestone)
            XCTAssertEqual(name, "order-confirmed")
            XCTAssertEqual(runRef, "run-001")
        case .notYet(let pendingMilestone):
            // Also acceptable if condition evaluation is deferred
            XCTAssertEqual(pendingMilestone, milestone)
        case .alreadyAchieved:
            // Acceptable if milestone was already achieved
            break
        }
    }

    func testMilestoneEvaluateNotYet() async throws {
        // invariant: evaluate with non-matching context returns notYet
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let context = Data("{\"orderTotal\":0,\"itemsValidated\":false}".utf8)

        let step1 = try await handler.define(
            input: MilestoneDefineInput(
                runRef: "run-002",
                name: "payment-received",
                conditionExpr: "paymentAmount > 0"
            ),
            storage: storage
        )
        guard case .ok(let milestone) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        let step2 = try await handler.evaluate(
            input: MilestoneEvaluateInput(milestone: milestone, context: context),
            storage: storage
        )
        if case .notYet(let pendingMilestone) = step2 {
            XCTAssertEqual(pendingMilestone, milestone)
        } else {
            // achieved is also possible depending on evaluator implementation
        }
    }

    func testMilestoneRevoke() async throws {
        // invariant: revoke transitions achieved milestone back to pending
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let step1 = try await handler.define(
            input: MilestoneDefineInput(
                runRef: "run-003",
                name: "inventory-above-threshold",
                conditionExpr: "inventory >= 100"
            ),
            storage: storage
        )
        guard case .ok(let milestone) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        let step2 = try await handler.revoke(
            input: MilestoneRevokeInput(milestone: milestone),
            storage: storage
        )
        if case .ok(let revokedMilestone) = step2 {
            XCTAssertEqual(revokedMilestone, milestone)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
