// generated: WebhookInbox/BusinessTests.swift

import XCTest
@testable import Clef

final class WebhookInboxBusinessTests: XCTestCase {

    // MARK: - Receive with wrong event type returns noMatch

    func testReceiveWithWrongEventTypeReturnsNoMatch() async throws {
        // A registered hook should not match a receive with a different event type
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let _ = try await handler.register(
            input: WebhookInboxRegisterInput(
                runRef: "run-type-mismatch",
                stepRef: "step-wait",
                eventType: "payment.completed",
                correlationKey: "order-type-test"
            ),
            storage: storage
        )

        let payload = Data("{\"status\":\"shipped\"}".utf8)
        let step2 = try await handler.receive(
            input: WebhookInboxReceiveInput(
                correlationKey: "order-type-test",
                eventType: "shipment.sent",
                payload: payload
            ),
            storage: storage
        )
        if case .noMatch(let key) = step2 {
            XCTAssertEqual(key, "order-type-test")
        } else {
            XCTFail("Expected .noMatch, got \(step2)")
        }
    }

    // MARK: - Multiple hooks with different correlation keys

    func testMultipleHooksWithDifferentCorrelationKeys() async throws {
        // Multiple hooks should match independently by correlation key
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let r1 = try await handler.register(
            input: WebhookInboxRegisterInput(
                runRef: "run-a",
                stepRef: "step-a",
                eventType: "order.completed",
                correlationKey: "order-aaa"
            ),
            storage: storage
        )
        guard case .ok(let hookA, _) = r1 else { XCTFail("Expected .ok"); return }

        let r2 = try await handler.register(
            input: WebhookInboxRegisterInput(
                runRef: "run-b",
                stepRef: "step-b",
                eventType: "order.completed",
                correlationKey: "order-bbb"
            ),
            storage: storage
        )
        guard case .ok(let hookB, _) = r2 else { XCTFail("Expected .ok"); return }

        XCTAssertNotEqual(hookA, hookB)

        let payloadA = Data("{\"order\":\"aaa\"}".utf8)
        let recvA = try await handler.receive(
            input: WebhookInboxReceiveInput(
                correlationKey: "order-aaa",
                eventType: "order.completed",
                payload: payloadA
            ),
            storage: storage
        )
        if case .ok(let receivedHook, let receivedRunRef, _, _) = recvA {
            XCTAssertEqual(receivedHook, hookA)
            XCTAssertEqual(receivedRunRef, "run-a")
        } else {
            XCTFail("Expected .ok, got \(recvA)")
        }
    }

    // MARK: - Expire then receive returns noMatch

    func testExpiredHookDoesNotMatchReceive() async throws {
        // After expiring a hook, subsequent receives should not match
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.register(
            input: WebhookInboxRegisterInput(
                runRef: "run-expire-recv",
                stepRef: "step-exp",
                eventType: "callback.response",
                correlationKey: "cb-expire"
            ),
            storage: storage
        )
        guard case .ok(let hook, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let _ = try await handler.expire(
            input: WebhookInboxExpireInput(hook: hook),
            storage: storage
        )

        let payload = Data("{\"late\":true}".utf8)
        let step3 = try await handler.receive(
            input: WebhookInboxReceiveInput(
                correlationKey: "cb-expire",
                eventType: "callback.response",
                payload: payload
            ),
            storage: storage
        )
        if case .noMatch(let key) = step3 {
            XCTAssertEqual(key, "cb-expire")
        } else {
            XCTFail("Expected .noMatch after expire, got \(step3)")
        }
    }

    // MARK: - Ack after receive

    func testAckAfterReceiveReturnsHookId() async throws {
        // Acknowledging a received hook should return the hook ID
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.register(
            input: WebhookInboxRegisterInput(
                runRef: "run-ack",
                stepRef: "step-ack",
                eventType: "notification.sent",
                correlationKey: "notif-001"
            ),
            storage: storage
        )
        guard case .ok(let hook, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let payload = Data("{\"delivered\":true}".utf8)
        let _ = try await handler.receive(
            input: WebhookInboxReceiveInput(
                correlationKey: "notif-001",
                eventType: "notification.sent",
                payload: payload
            ),
            storage: storage
        )

        let step3 = try await handler.ack(
            input: WebhookInboxAckInput(hook: hook),
            storage: storage
        )
        if case .ok(let ackedHook) = step3 {
            XCTAssertEqual(ackedHook, hook)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    // MARK: - Register multiple hooks for same run

    func testRegisterMultipleHooksForSameRun() async throws {
        // A single run can have multiple webhook hooks registered
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let r1 = try await handler.register(
            input: WebhookInboxRegisterInput(
                runRef: "run-multi",
                stepRef: "step-payment",
                eventType: "payment.completed",
                correlationKey: "order-multi-1"
            ),
            storage: storage
        )
        guard case .ok(let hook1, _) = r1 else { XCTFail("Expected .ok"); return }

        let r2 = try await handler.register(
            input: WebhookInboxRegisterInput(
                runRef: "run-multi",
                stepRef: "step-shipping",
                eventType: "shipment.dispatched",
                correlationKey: "order-multi-2"
            ),
            storage: storage
        )
        guard case .ok(let hook2, _) = r2 else { XCTFail("Expected .ok"); return }

        XCTAssertNotEqual(hook1, hook2)
    }

    // MARK: - Expire returns run and step refs

    func testExpireReturnsCorrectReferences() async throws {
        // Expire should return the original runRef and stepRef
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.register(
            input: WebhookInboxRegisterInput(
                runRef: "run-expire-ref",
                stepRef: "step-expire-ref",
                eventType: "timeout.check",
                correlationKey: "timeout-001"
            ),
            storage: storage
        )
        guard case .ok(let hook, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.expire(
            input: WebhookInboxExpireInput(hook: hook),
            storage: storage
        )
        if case .ok(let expiredHook, let runRef, let stepRef) = step2 {
            XCTAssertEqual(expiredHook, hook)
            XCTAssertEqual(runRef, "run-expire-ref")
            XCTAssertEqual(stepRef, "step-expire-ref")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    // MARK: - Receive preserves correlation to correct step

    func testReceiveMatchesCorrectStepRef() async throws {
        // When multiple hooks exist, receive should match the correct stepRef
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let _ = try await handler.register(
            input: WebhookInboxRegisterInput(
                runRef: "run-match",
                stepRef: "step-first",
                eventType: "event.a",
                correlationKey: "corr-match-a"
            ),
            storage: storage
        )

        let _ = try await handler.register(
            input: WebhookInboxRegisterInput(
                runRef: "run-match",
                stepRef: "step-second",
                eventType: "event.b",
                correlationKey: "corr-match-b"
            ),
            storage: storage
        )

        let payload = Data("{\"data\":\"b\"}".utf8)
        let recv = try await handler.receive(
            input: WebhookInboxReceiveInput(
                correlationKey: "corr-match-b",
                eventType: "event.b",
                payload: payload
            ),
            storage: storage
        )
        if case .ok(_, let runRef, let stepRef, _) = recv {
            XCTAssertEqual(runRef, "run-match")
            XCTAssertEqual(stepRef, "step-second")
        } else {
            XCTFail("Expected .ok, got \(recv)")
        }
    }

    // MARK: - Unique hook IDs

    func testEachRegisterReturnsUniqueHookId() async throws {
        // Each registration should return a unique hook ID
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        var hookIds: Set<String> = []
        for i in 1...5 {
            let result = try await handler.register(
                input: WebhookInboxRegisterInput(
                    runRef: "run-uniq-\(i)",
                    stepRef: "step-\(i)",
                    eventType: "event.\(i)",
                    correlationKey: "corr-\(i)"
                ),
                storage: storage
            )
            guard case .ok(let hook, _) = result else {
                XCTFail("Expected .ok, got \(result)")
                return
            }
            hookIds.insert(hook)
        }
        XCTAssertEqual(hookIds.count, 5, "All 5 hook IDs should be unique")
    }

}
