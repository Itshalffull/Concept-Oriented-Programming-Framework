// generated: WebhookInbox/ConformanceTests.swift

import XCTest
@testable import Clef

final class WebhookInboxConformanceTests: XCTestCase {

    func testWebhookInboxRegisterAndReceive() async throws {
        // invariant: after register, receive matches inbound event by correlation key + event type
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let payload = Data("{\"status\":\"paid\"}".utf8)

        // --- AFTER clause ---
        let step1 = try await handler.register(
            input: WebhookInboxRegisterInput(
                runRef: "run-001",
                stepRef: "step-wait-payment",
                eventType: "payment.completed",
                correlationKey: "order-123"
            ),
            storage: storage
        )
        guard case .ok(let hook, let runRef) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }
        XCTAssertFalse(hook.isEmpty)
        XCTAssertEqual(runRef, "run-001")

        // --- THEN clause ---
        let step2 = try await handler.receive(
            input: WebhookInboxReceiveInput(
                correlationKey: "order-123",
                eventType: "payment.completed",
                payload: payload
            ),
            storage: storage
        )
        if case .ok(let receivedHook, let receivedRunRef, let receivedStepRef, _) = step2 {
            XCTAssertEqual(receivedHook, hook)
            XCTAssertEqual(receivedRunRef, "run-001")
            XCTAssertEqual(receivedStepRef, "step-wait-payment")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testWebhookInboxReceiveNoMatch() async throws {
        // invariant: receive with unknown correlation key returns noMatch
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let payload = Data("{\"event\":\"unknown\"}".utf8)

        let step1 = try await handler.receive(
            input: WebhookInboxReceiveInput(
                correlationKey: "nonexistent-key",
                eventType: "some.event",
                payload: payload
            ),
            storage: storage
        )
        if case .noMatch(let key) = step1 {
            XCTAssertEqual(key, "nonexistent-key")
        } else {
            XCTFail("Expected .noMatch, got \(step1)")
        }
    }

    func testWebhookInboxReceiveAndAck() async throws {
        // invariant: after receive, ack transitions hook to acknowledged
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let payload = Data("{\"tracking\":\"XYZ\"}".utf8)

        let step1 = try await handler.register(
            input: WebhookInboxRegisterInput(
                runRef: "run-002",
                stepRef: "step-wait-shipment",
                eventType: "shipment.update",
                correlationKey: "ship-456"
            ),
            storage: storage
        )
        guard case .ok(let hook, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.receive(
            input: WebhookInboxReceiveInput(
                correlationKey: "ship-456",
                eventType: "shipment.update",
                payload: payload
            ),
            storage: storage
        )
        guard case .ok = step2 else {
            XCTFail("Expected .ok, got \(step2)")
            return
        }

        // --- THEN clause ---
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

    func testWebhookInboxExpire() async throws {
        // invariant: after register, expire transitions the hook to expired
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let step1 = try await handler.register(
            input: WebhookInboxRegisterInput(
                runRef: "run-003",
                stepRef: "step-wait-approval",
                eventType: "approval.response",
                correlationKey: "approval-789"
            ),
            storage: storage
        )
        guard case .ok(let hook, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        let step2 = try await handler.expire(
            input: WebhookInboxExpireInput(hook: hook),
            storage: storage
        )
        if case .ok(let expiredHook, let runRef, let stepRef) = step2 {
            XCTAssertEqual(expiredHook, hook)
            XCTAssertEqual(runRef, "run-003")
            XCTAssertEqual(stepRef, "step-wait-approval")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
