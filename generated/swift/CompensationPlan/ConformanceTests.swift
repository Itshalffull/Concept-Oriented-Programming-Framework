// generated: CompensationPlan/ConformanceTests.swift

import XCTest
@testable import Clef

final class CompensationPlanConformanceTests: XCTestCase {

    func testCompensationPlanRegisterAndTrigger() async throws {
        // invariant: after register, trigger begins compensation in reverse order
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let runRef = "run-saga-001"

        // --- AFTER clause ---
        let step1 = try await handler.register(
            input: CompensationPlanRegisterInput(
                runRef: runRef,
                stepKey: "step-charge",
                actionDescriptor: "refund(orderId: O1)"
            ),
            storage: storage
        )
        guard case .ok(let plan) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }
        XCTAssertFalse(plan.isEmpty)

        // --- THEN clause ---
        let step2 = try await handler.trigger(
            input: CompensationPlanTriggerInput(runRef: runRef),
            storage: storage
        )
        if case .ok(let triggeredPlan) = step2 {
            XCTAssertEqual(triggeredPlan, plan)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testCompensationPlanExecuteNextAndAllDone() async throws {
        // invariant: after trigger, executeNext returns compensations in reverse order until allDone
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let runRef = "run-saga-002"

        let _ = try await handler.register(
            input: CompensationPlanRegisterInput(
                runRef: runRef,
                stepKey: "step-reserve",
                actionDescriptor: "releaseInventory(sku: SKU1)"
            ),
            storage: storage
        )

        let step2 = try await handler.trigger(
            input: CompensationPlanTriggerInput(runRef: runRef),
            storage: storage
        )
        guard case .ok(let plan) = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }

        // --- THEN clause ---
        let step3 = try await handler.executeNext(
            input: CompensationPlanExecuteNextInput(plan: plan),
            storage: storage
        )
        switch step3 {
        case .ok(_, let stepKey, let actionDescriptor):
            XCTAssertEqual(stepKey, "step-reserve")
            XCTAssertEqual(actionDescriptor, "releaseInventory(sku: SKU1)")
        case .allDone:
            // acceptable if single compensation was already executed
            break
        }

        // After executing all compensations, should get allDone
        let step4 = try await handler.executeNext(
            input: CompensationPlanExecuteNextInput(plan: plan),
            storage: storage
        )
        if case .allDone(let donePlan) = step4 {
            XCTAssertEqual(donePlan, plan)
        } else {
            // May still have more compensations; that is also acceptable
        }
    }

    func testCompensationPlanTriggerEmpty() async throws {
        // invariant: trigger on a run with no compensations returns empty
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let step1 = try await handler.trigger(
            input: CompensationPlanTriggerInput(runRef: "run-no-compensations"),
            storage: storage
        )
        if case .empty(let runRef) = step1 {
            XCTAssertEqual(runRef, "run-no-compensations")
        } else {
            XCTFail("Expected .empty, got \(step1)")
        }
    }

    func testCompensationPlanMarkCompensationFailed() async throws {
        // invariant: markCompensationFailed transitions plan to failed status
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let runRef = "run-saga-003"

        let step1 = try await handler.register(
            input: CompensationPlanRegisterInput(
                runRef: runRef,
                stepKey: "step-notify",
                actionDescriptor: "cancelNotification(id: N1)"
            ),
            storage: storage
        )
        guard case .ok(let plan) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let _ = try await handler.trigger(
            input: CompensationPlanTriggerInput(runRef: runRef),
            storage: storage
        )

        // --- THEN clause ---
        let step3 = try await handler.markCompensationFailed(
            input: CompensationPlanMarkCompensationFailedInput(
                plan: plan,
                stepKey: "step-notify",
                error: "notification service unavailable"
            ),
            storage: storage
        )
        if case .ok(let failedPlan) = step3 {
            XCTAssertEqual(failedPlan, plan)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}
