// generated: Timer/ConformanceTests.swift

import XCTest
@testable import Clef

final class TimerConformanceTests: XCTestCase {

    func testTimerSetAndFire() async throws {
        // invariant: after setTimer, fire returns the timer context for processing
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        // --- AFTER clause ---
        let step1 = try await handler.setTimer(
            input: TimerSetTimerInput(
                runRef: "run-001",
                timerType: "duration",
                specification: "PT30S",
                purposeTag: "retry",
                contextRef: "step-kyc"
            ),
            storage: storage
        )
        guard case .ok(let timer, let runRef, let nextFireAt) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }
        XCTAssertFalse(timer.isEmpty)
        XCTAssertEqual(runRef, "run-001")
        XCTAssertFalse(nextFireAt.isEmpty)

        // --- THEN clause ---
        let step2 = try await handler.fire(
            input: TimerFireInput(timer: timer),
            storage: storage
        )
        if case .ok(let firedTimer, let firedRunRef, let purposeTag, let contextRef) = step2 {
            XCTAssertEqual(firedTimer, timer)
            XCTAssertEqual(firedRunRef, "run-001")
            XCTAssertEqual(purposeTag, "retry")
            XCTAssertEqual(contextRef, "step-kyc")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testTimerSetAndCancel() async throws {
        // invariant: after setTimer, cancel transitions to cancelled
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let step1 = try await handler.setTimer(
            input: TimerSetTimerInput(
                runRef: "run-002",
                timerType: "date",
                specification: "2026-12-31T23:59:59Z",
                purposeTag: "escalation",
                contextRef: "step-approval"
            ),
            storage: storage
        )
        guard case .ok(let timer, _, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        let step2 = try await handler.cancel(
            input: TimerCancelInput(timer: timer),
            storage: storage
        )
        if case .ok(let cancelledTimer) = step2 {
            XCTAssertEqual(cancelledTimer, timer)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testTimerReset() async throws {
        // invariant: after setTimer, reset updates the specification and next fire time
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let step1 = try await handler.setTimer(
            input: TimerSetTimerInput(
                runRef: "run-003",
                timerType: "duration",
                specification: "PT10S",
                purposeTag: "sla",
                contextRef: "step-process"
            ),
            storage: storage
        )
        guard case .ok(let timer, _, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        let step2 = try await handler.reset(
            input: TimerResetInput(timer: timer, specification: "PT60S"),
            storage: storage
        )
        if case .ok(let resetTimer, let nextFireAt) = step2 {
            XCTAssertEqual(resetTimer, timer)
            XCTAssertFalse(nextFireAt.isEmpty)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testTimerInvalidSpec() async throws {
        // invariant: setTimer with invalid specification returns invalidSpec
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let step1 = try await handler.setTimer(
            input: TimerSetTimerInput(
                runRef: "run-004",
                timerType: "duration",
                specification: "not-a-valid-duration",
                purposeTag: "test",
                contextRef: "step-test"
            ),
            storage: storage
        )
        if case .invalidSpec(let spec) = step1 {
            XCTAssertEqual(spec, "not-a-valid-duration")
        } else {
            XCTFail("Expected .invalidSpec, got \(step1)")
        }
    }

}
