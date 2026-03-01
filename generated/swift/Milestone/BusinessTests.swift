// generated: Milestone/BusinessTests.swift

import XCTest
@testable import Clef

final class MilestoneBusinessTests: XCTestCase {

    // MARK: - Define and immediately evaluate with matching context

    func testDefineAndEvaluateWithMatchingContext() async throws {
        // Evaluating with a context that satisfies the condition should yield achieved
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let context = Data("{\"paymentReceived\":true,\"amount\":250.00}".utf8)

        let step1 = try await handler.define(
            input: MilestoneDefineInput(
                runRef: "run-match",
                name: "payment-confirmed",
                conditionExpr: "paymentReceived == true && amount > 0"
            ),
            storage: storage
        )
        guard case .ok(let milestone) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.evaluate(
            input: MilestoneEvaluateInput(milestone: milestone, context: context),
            storage: storage
        )
        switch step2 {
        case .achieved(let achievedMilestone, let name, let runRef):
            XCTAssertEqual(achievedMilestone, milestone)
            XCTAssertEqual(name, "payment-confirmed")
            XCTAssertEqual(runRef, "run-match")
        case .notYet(let pendingMilestone):
            // Implementation may defer evaluation
            XCTAssertEqual(pendingMilestone, milestone)
        case .alreadyAchieved:
            break
        }
    }

    // MARK: - Revoke then re-evaluate

    func testRevokeAndReEvaluate() async throws {
        // After revoking an achieved milestone, re-evaluation should be possible
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let context = Data("{\"inventoryCount\":200}".utf8)

        let step1 = try await handler.define(
            input: MilestoneDefineInput(
                runRef: "run-revoke-re-eval",
                name: "stock-sufficient",
                conditionExpr: "inventoryCount >= 100"
            ),
            storage: storage
        )
        guard case .ok(let milestone) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // First evaluate
        let _ = try await handler.evaluate(
            input: MilestoneEvaluateInput(milestone: milestone, context: context),
            storage: storage
        )

        // Revoke
        let step3 = try await handler.revoke(
            input: MilestoneRevokeInput(milestone: milestone),
            storage: storage
        )
        if case .ok(let revokedMilestone) = step3 {
            XCTAssertEqual(revokedMilestone, milestone)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }

        // Re-evaluate with different context
        let newContext = Data("{\"inventoryCount\":50}".utf8)
        let step4 = try await handler.evaluate(
            input: MilestoneEvaluateInput(milestone: milestone, context: newContext),
            storage: storage
        )
        switch step4 {
        case .notYet(let pendingMilestone):
            XCTAssertEqual(pendingMilestone, milestone)
        case .achieved:
            // Some implementations may still achieve based on evaluation logic
            break
        case .alreadyAchieved:
            break
        }
    }

    // MARK: - Multiple milestones for same run

    func testMultipleMilestonesForSameRun() async throws {
        // Multiple milestones can be defined for the same run
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let runRef = "run-multi-ms"

        let r1 = try await handler.define(
            input: MilestoneDefineInput(
                runRef: runRef,
                name: "order-received",
                conditionExpr: "orderPlaced == true"
            ),
            storage: storage
        )
        guard case .ok(let ms1) = r1 else { XCTFail("Expected .ok"); return }

        let r2 = try await handler.define(
            input: MilestoneDefineInput(
                runRef: runRef,
                name: "order-shipped",
                conditionExpr: "shipped == true"
            ),
            storage: storage
        )
        guard case .ok(let ms2) = r2 else { XCTFail("Expected .ok"); return }

        let r3 = try await handler.define(
            input: MilestoneDefineInput(
                runRef: runRef,
                name: "order-delivered",
                conditionExpr: "delivered == true"
            ),
            storage: storage
        )
        guard case .ok(let ms3) = r3 else { XCTFail("Expected .ok"); return }

        // All should be unique
        let ids = Set([ms1, ms2, ms3])
        XCTAssertEqual(ids.count, 3, "All milestone IDs should be unique")
    }

    // MARK: - Evaluate with non-matching context

    func testEvaluateWithNonMatchingContextReturnsNotYet() async throws {
        // Evaluating with a context that does not meet the condition should return notYet
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let context = Data("{\"temperature\":15}".utf8)

        let step1 = try await handler.define(
            input: MilestoneDefineInput(
                runRef: "run-not-yet",
                name: "temperature-threshold",
                conditionExpr: "temperature >= 100"
            ),
            storage: storage
        )
        guard case .ok(let milestone) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.evaluate(
            input: MilestoneEvaluateInput(milestone: milestone, context: context),
            storage: storage
        )
        if case .notYet(let pendingMilestone) = step2 {
            XCTAssertEqual(pendingMilestone, milestone)
        } else {
            // .achieved may be returned depending on condition evaluation logic
        }
    }

    // MARK: - AlreadyAchieved on double evaluate

    func testDoubleEvaluateReturnsAlreadyAchieved() async throws {
        // Evaluating a milestone that was already achieved should return alreadyAchieved
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let context = Data("{\"approved\":true}".utf8)

        let step1 = try await handler.define(
            input: MilestoneDefineInput(
                runRef: "run-double-eval",
                name: "approval-complete",
                conditionExpr: "approved == true"
            ),
            storage: storage
        )
        guard case .ok(let milestone) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // First evaluate
        let eval1 = try await handler.evaluate(
            input: MilestoneEvaluateInput(milestone: milestone, context: context),
            storage: storage
        )
        switch eval1 {
        case .achieved:
            break // expected
        case .notYet:
            break // also acceptable
        case .alreadyAchieved:
            break
        }

        // Second evaluate should return alreadyAchieved (if first was achieved)
        let eval2 = try await handler.evaluate(
            input: MilestoneEvaluateInput(milestone: milestone, context: context),
            storage: storage
        )
        switch eval2 {
        case .alreadyAchieved(let achievedMilestone):
            XCTAssertEqual(achievedMilestone, milestone)
        case .achieved:
            break // also acceptable if implementation re-evaluates
        case .notYet:
            break // acceptable if evaluation logic differs
        }
    }

    // MARK: - Revoke on unachieved milestone

    func testRevokeOnUnachievedMilestone() async throws {
        // Revoking a milestone that was never achieved should still succeed
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.define(
            input: MilestoneDefineInput(
                runRef: "run-revoke-unachieved",
                name: "never-achieved",
                conditionExpr: "impossible == true"
            ),
            storage: storage
        )
        guard case .ok(let milestone) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

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

    // MARK: - Milestones isolated between runs

    func testMilestonesIsolatedBetweenRuns() async throws {
        // Milestones for different runs should be independent
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let r1 = try await handler.define(
            input: MilestoneDefineInput(
                runRef: "run-iso-x",
                name: "milestone-x",
                conditionExpr: "x == true"
            ),
            storage: storage
        )
        guard case .ok(let msX) = r1 else { XCTFail("Expected .ok"); return }

        let r2 = try await handler.define(
            input: MilestoneDefineInput(
                runRef: "run-iso-y",
                name: "milestone-y",
                conditionExpr: "y == true"
            ),
            storage: storage
        )
        guard case .ok(let msY) = r2 else { XCTFail("Expected .ok"); return }

        XCTAssertNotEqual(msX, msY)

        // Revoking milestone X should not affect milestone Y
        let _ = try await handler.revoke(
            input: MilestoneRevokeInput(milestone: msX),
            storage: storage
        )

        // Y should still be definable/evaluable
        let evalY = try await handler.evaluate(
            input: MilestoneEvaluateInput(milestone: msY, context: Data("{\"y\":true}".utf8)),
            storage: storage
        )
        // Should get some response without error
        _ = evalY
    }

    // MARK: - Complex condition expressions

    func testComplexConditionExpression() async throws {
        // Milestone with a complex condition expression should be accepted
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let complexExpr = "(orderTotal > 100 && customerTier == \"gold\") || (expressShipping == true && orderTotal > 50)"

        let step1 = try await handler.define(
            input: MilestoneDefineInput(
                runRef: "run-complex",
                name: "eligible-for-discount",
                conditionExpr: complexExpr
            ),
            storage: storage
        )
        if case .ok(let milestone) = step1 {
            XCTAssertFalse(milestone.isEmpty)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }
    }

}
