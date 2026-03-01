// generated: Timer/BusinessTests.swift

import XCTest
@testable import Clef

final class TimerBusinessTests: XCTestCase {

    // MARK: - Fire returns correct purpose and context

    func testFireReturnsCorrectPurposeAndContext() async throws {
        // Fire should return the purposeTag and contextRef set during setTimer
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.setTimer(
            input: TimerSetTimerInput(
                runRef: "run-purpose",
                timerType: "duration",
                specification: "PT5M",
                purposeTag: "sla-warning",
                contextRef: "step-approval"
            ),
            storage: storage
        )
        guard case .ok(let timer, _, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.fire(
            input: TimerFireInput(timer: timer),
            storage: storage
        )
        if case .ok(let firedTimer, let runRef, let purposeTag, let contextRef) = step2 {
            XCTAssertEqual(firedTimer, timer)
            XCTAssertEqual(runRef, "run-purpose")
            XCTAssertEqual(purposeTag, "sla-warning")
            XCTAssertEqual(contextRef, "step-approval")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    // MARK: - Cancel after fire

    func testCancelAfterFireIsHandled() async throws {
        // Cancelling a timer that has already fired should be handled gracefully
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.setTimer(
            input: TimerSetTimerInput(
                runRef: "run-cancel-after-fire",
                timerType: "duration",
                specification: "PT1S",
                purposeTag: "retry",
                contextRef: "step-x"
            ),
            storage: storage
        )
        guard case .ok(let timer, _, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let _ = try await handler.fire(
            input: TimerFireInput(timer: timer),
            storage: storage
        )

        // Cancelling after fire - implementation may succeed or return an error
        let step3 = try await handler.cancel(
            input: TimerCancelInput(timer: timer),
            storage: storage
        )
        // Either ok or an error case is acceptable; it should not crash
        _ = step3
    }

    // MARK: - Multiple timers for same run

    func testMultipleTimersForSameRun() async throws {
        // Multiple timers can be set for the same run with different purposes
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let runRef = "run-multi-timer"

        let r1 = try await handler.setTimer(
            input: TimerSetTimerInput(
                runRef: runRef,
                timerType: "duration",
                specification: "PT10S",
                purposeTag: "retry",
                contextRef: "step-call"
            ),
            storage: storage
        )
        guard case .ok(let timer1, _, _) = r1 else { XCTFail("Expected .ok"); return }

        let r2 = try await handler.setTimer(
            input: TimerSetTimerInput(
                runRef: runRef,
                timerType: "duration",
                specification: "PT60S",
                purposeTag: "escalation",
                contextRef: "step-wait"
            ),
            storage: storage
        )
        guard case .ok(let timer2, _, _) = r2 else { XCTFail("Expected .ok"); return }

        XCTAssertNotEqual(timer1, timer2)

        // Fire timer1, cancel timer2
        let fire1 = try await handler.fire(
            input: TimerFireInput(timer: timer1),
            storage: storage
        )
        if case .ok(_, _, let purposeTag, _) = fire1 {
            XCTAssertEqual(purposeTag, "retry")
        } else {
            XCTFail("Expected .ok, got \(fire1)")
        }

        let cancel2 = try await handler.cancel(
            input: TimerCancelInput(timer: timer2),
            storage: storage
        )
        if case .ok(let cancelledTimer) = cancel2 {
            XCTAssertEqual(cancelledTimer, timer2)
        } else {
            XCTFail("Expected .ok, got \(cancel2)")
        }
    }

    // MARK: - Reset changes next fire time

    func testResetChangesNextFireTime() async throws {
        // Resetting a timer with a different specification should produce a different fire time
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.setTimer(
            input: TimerSetTimerInput(
                runRef: "run-reset-time",
                timerType: "duration",
                specification: "PT5S",
                purposeTag: "test",
                contextRef: "step-test"
            ),
            storage: storage
        )
        guard case .ok(let timer, _, let originalFireAt) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.reset(
            input: TimerResetInput(timer: timer, specification: "PT300S"),
            storage: storage
        )
        if case .ok(let resetTimer, let newFireAt) = step2 {
            XCTAssertEqual(resetTimer, timer)
            XCTAssertFalse(newFireAt.isEmpty)
            // The new fire time should be different from the original
            XCTAssertNotEqual(newFireAt, originalFireAt)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    // MARK: - Date-type timer

    func testDateTypeTimer() async throws {
        // A date-type timer should be created and fireable
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.setTimer(
            input: TimerSetTimerInput(
                runRef: "run-date",
                timerType: "date",
                specification: "2027-06-15T12:00:00Z",
                purposeTag: "deadline",
                contextRef: "step-deadline"
            ),
            storage: storage
        )
        guard case .ok(let timer, _, let nextFireAt) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }
        XCTAssertFalse(timer.isEmpty)
        XCTAssertFalse(nextFireAt.isEmpty)

        let step2 = try await handler.fire(
            input: TimerFireInput(timer: timer),
            storage: storage
        )
        if case .ok(_, _, let purposeTag, let contextRef) = step2 {
            XCTAssertEqual(purposeTag, "deadline")
            XCTAssertEqual(contextRef, "step-deadline")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    // MARK: - Reset then fire

    func testResetThenFire() async throws {
        // After resetting a timer, fire should still return correct context
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.setTimer(
            input: TimerSetTimerInput(
                runRef: "run-reset-fire",
                timerType: "duration",
                specification: "PT10S",
                purposeTag: "retry",
                contextRef: "step-retry"
            ),
            storage: storage
        )
        guard case .ok(let timer, _, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let _ = try await handler.reset(
            input: TimerResetInput(timer: timer, specification: "PT30S"),
            storage: storage
        )

        let step3 = try await handler.fire(
            input: TimerFireInput(timer: timer),
            storage: storage
        )
        if case .ok(let firedTimer, let runRef, let purposeTag, let contextRef) = step3 {
            XCTAssertEqual(firedTimer, timer)
            XCTAssertEqual(runRef, "run-reset-fire")
            XCTAssertEqual(purposeTag, "retry")
            XCTAssertEqual(contextRef, "step-retry")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    // MARK: - Multiple resets

    func testMultipleResetsOnSameTimer() async throws {
        // A timer should support being reset multiple times
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.setTimer(
            input: TimerSetTimerInput(
                runRef: "run-multi-reset",
                timerType: "duration",
                specification: "PT5S",
                purposeTag: "watchdog",
                contextRef: "step-wd"
            ),
            storage: storage
        )
        guard case .ok(let timer, _, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let specs = ["PT10S", "PT20S", "PT30S"]
        for spec in specs {
            let r = try await handler.reset(
                input: TimerResetInput(timer: timer, specification: spec),
                storage: storage
            )
            if case .ok(let resetTimer, let nextFireAt) = r {
                XCTAssertEqual(resetTimer, timer)
                XCTAssertFalse(nextFireAt.isEmpty)
            } else {
                XCTFail("Expected .ok for spec \(spec), got \(r)")
            }
        }
    }

    // MARK: - Unique timer IDs

    func testEachSetTimerReturnsUniqueId() async throws {
        // Each setTimer call should produce a unique timer ID
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        var timerIds: Set<String> = []
        for i in 1...6 {
            let result = try await handler.setTimer(
                input: TimerSetTimerInput(
                    runRef: "run-uniq-\(i)",
                    timerType: "duration",
                    specification: "PT\(i * 10)S",
                    purposeTag: "tag-\(i)",
                    contextRef: "ctx-\(i)"
                ),
                storage: storage
            )
            guard case .ok(let timer, _, _) = result else {
                XCTFail("Expected .ok, got \(result)")
                return
            }
            timerIds.insert(timer)
        }
        XCTAssertEqual(timerIds.count, 6, "All 6 timer IDs should be unique")
    }

}
