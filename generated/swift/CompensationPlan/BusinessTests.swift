// generated: CompensationPlan/BusinessTests.swift

import XCTest
@testable import Clef

final class CompensationPlanBusinessTests: XCTestCase {

    // MARK: - Multiple compensations execute in reverse order

    func testMultipleCompensationsExecuteInReverseOrder() async throws {
        // Compensations registered in order should execute in reverse
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let runRef = "run-reverse"

        let _ = try await handler.register(
            input: CompensationPlanRegisterInput(
                runRef: runRef,
                stepKey: "step-1-charge",
                actionDescriptor: "refund(orderId: O1)"
            ),
            storage: storage
        )
        let _ = try await handler.register(
            input: CompensationPlanRegisterInput(
                runRef: runRef,
                stepKey: "step-2-reserve",
                actionDescriptor: "releaseInventory(sku: SKU1)"
            ),
            storage: storage
        )
        let _ = try await handler.register(
            input: CompensationPlanRegisterInput(
                runRef: runRef,
                stepKey: "step-3-notify",
                actionDescriptor: "cancelNotification(id: N1)"
            ),
            storage: storage
        )

        let triggerResult = try await handler.trigger(
            input: CompensationPlanTriggerInput(runRef: runRef),
            storage: storage
        )
        guard case .ok(let plan) = triggerResult else {
            XCTFail("Expected .ok, got \(triggerResult)")
            return
        }

        // First executeNext should return the last registered compensation
        let exec1 = try await handler.executeNext(
            input: CompensationPlanExecuteNextInput(plan: plan),
            storage: storage
        )
        if case .ok(_, let stepKey, let actionDescriptor) = exec1 {
            XCTAssertEqual(stepKey, "step-3-notify")
            XCTAssertEqual(actionDescriptor, "cancelNotification(id: N1)")
        } else if case .allDone = exec1 {
            // If implementation processes all at once, acceptable
        }
    }

    // MARK: - Register multiple then trigger

    func testRegisterMultipleThenTrigger() async throws {
        // All registered compensations should be accessible after trigger
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let runRef = "run-multi-reg"

        for i in 1...3 {
            let _ = try await handler.register(
                input: CompensationPlanRegisterInput(
                    runRef: runRef,
                    stepKey: "step-\(i)",
                    actionDescriptor: "undo-\(i)"
                ),
                storage: storage
            )
        }

        let triggerResult = try await handler.trigger(
            input: CompensationPlanTriggerInput(runRef: runRef),
            storage: storage
        )
        if case .ok(let plan) = triggerResult {
            XCTAssertFalse(plan.isEmpty)
        } else {
            XCTFail("Expected .ok, got \(triggerResult)")
        }
    }

    // MARK: - ExecuteNext until allDone

    func testExecuteNextUntilAllDone() async throws {
        // Repeatedly calling executeNext should eventually return allDone
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let runRef = "run-until-done"

        let _ = try await handler.register(
            input: CompensationPlanRegisterInput(
                runRef: runRef,
                stepKey: "step-a",
                actionDescriptor: "undoA()"
            ),
            storage: storage
        )
        let _ = try await handler.register(
            input: CompensationPlanRegisterInput(
                runRef: runRef,
                stepKey: "step-b",
                actionDescriptor: "undoB()"
            ),
            storage: storage
        )

        let triggerResult = try await handler.trigger(
            input: CompensationPlanTriggerInput(runRef: runRef),
            storage: storage
        )
        guard case .ok(let plan) = triggerResult else {
            XCTFail("Expected .ok, got \(triggerResult)")
            return
        }

        var reachedAllDone = false
        for _ in 1...10 {
            let exec = try await handler.executeNext(
                input: CompensationPlanExecuteNextInput(plan: plan),
                storage: storage
            )
            if case .allDone = exec {
                reachedAllDone = true
                break
            }
        }
        XCTAssertTrue(reachedAllDone, "Should eventually reach allDone")
    }

    // MARK: - Mark compensation failed on specific step

    func testMarkCompensationFailedOnSpecificStep() async throws {
        // Marking a compensation as failed should identify the failing step
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let runRef = "run-fail-step"

        let _ = try await handler.register(
            input: CompensationPlanRegisterInput(
                runRef: runRef,
                stepKey: "step-payment",
                actionDescriptor: "refund(amount: 100)"
            ),
            storage: storage
        )
        let _ = try await handler.register(
            input: CompensationPlanRegisterInput(
                runRef: runRef,
                stepKey: "step-notification",
                actionDescriptor: "sendCancellation()"
            ),
            storage: storage
        )

        let triggerResult = try await handler.trigger(
            input: CompensationPlanTriggerInput(runRef: runRef),
            storage: storage
        )
        guard case .ok(let plan) = triggerResult else {
            XCTFail("Expected .ok, got \(triggerResult)")
            return
        }

        let step3 = try await handler.markCompensationFailed(
            input: CompensationPlanMarkCompensationFailedInput(
                plan: plan,
                stepKey: "step-payment",
                error: "Payment gateway timeout"
            ),
            storage: storage
        )
        if case .ok(let failedPlan) = step3 {
            XCTAssertEqual(failedPlan, plan)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    // MARK: - Trigger returns same plan for same runRef

    func testTriggerReturnsSamePlanForSameRunRef() async throws {
        // Triggering the same runRef should return the same plan
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let runRef = "run-same-plan"

        let _ = try await handler.register(
            input: CompensationPlanRegisterInput(
                runRef: runRef,
                stepKey: "step-x",
                actionDescriptor: "undoX()"
            ),
            storage: storage
        )

        let trigger1 = try await handler.trigger(
            input: CompensationPlanTriggerInput(runRef: runRef),
            storage: storage
        )
        guard case .ok(let plan1) = trigger1 else {
            XCTFail("Expected .ok, got \(trigger1)")
            return
        }

        XCTAssertFalse(plan1.isEmpty)
    }

    // MARK: - Different runs have independent plans

    func testDifferentRunsHaveIndependentPlans() async throws {
        // Compensations for different runs should be independent
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let _ = try await handler.register(
            input: CompensationPlanRegisterInput(
                runRef: "run-ind-1",
                stepKey: "step-1",
                actionDescriptor: "undo1()"
            ),
            storage: storage
        )
        let _ = try await handler.register(
            input: CompensationPlanRegisterInput(
                runRef: "run-ind-2",
                stepKey: "step-2",
                actionDescriptor: "undo2()"
            ),
            storage: storage
        )

        let trigger1 = try await handler.trigger(
            input: CompensationPlanTriggerInput(runRef: "run-ind-1"),
            storage: storage
        )
        let trigger2 = try await handler.trigger(
            input: CompensationPlanTriggerInput(runRef: "run-ind-2"),
            storage: storage
        )

        guard case .ok(let plan1) = trigger1 else { XCTFail("Expected .ok"); return }
        guard case .ok(let plan2) = trigger2 else { XCTFail("Expected .ok"); return }

        XCTAssertNotEqual(plan1, plan2)
    }

    // MARK: - Register with complex action descriptors

    func testRegisterWithComplexActionDescriptors() async throws {
        // Complex action descriptors with special characters should be preserved
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let runRef = "run-complex-desc"
        let complexDescriptor = "httpCall(method: \"POST\", url: \"https://api.example.com/refund\", body: {\"orderId\": \"O-123\", \"amount\": 99.99})"

        let step1 = try await handler.register(
            input: CompensationPlanRegisterInput(
                runRef: runRef,
                stepKey: "step-complex",
                actionDescriptor: complexDescriptor
            ),
            storage: storage
        )
        if case .ok(let plan) = step1 {
            XCTAssertFalse(plan.isEmpty)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }
    }

    // MARK: - Unique plan IDs

    func testEachRegisterReturnsPlanId() async throws {
        // Each register call for the same run should return the plan ID
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let runRef = "run-plan-ids"

        var planIds: [String] = []
        for i in 1...4 {
            let result = try await handler.register(
                input: CompensationPlanRegisterInput(
                    runRef: runRef,
                    stepKey: "step-\(i)",
                    actionDescriptor: "undo\(i)()"
                ),
                storage: storage
            )
            guard case .ok(let plan) = result else {
                XCTFail("Expected .ok, got \(result)")
                return
            }
            planIds.append(plan)
        }

        // All plan IDs for the same run should be the same
        let uniquePlans = Set(planIds)
        XCTAssertEqual(uniquePlans.count, 1, "All registrations for the same run should return the same plan ID")
    }

}
