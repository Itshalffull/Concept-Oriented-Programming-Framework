// generated: ConnectorCall/ConformanceTests.swift

import XCTest
@testable import Clef

final class ConnectorCallConformanceTests: XCTestCase {

    func testConnectorCallInvokeAndGetResult() async throws {
        // invariant: after invoke, getResult returns the call in invoking status
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let inputPayload = Data("{\"account\":\"A1\"}".utf8)

        // --- AFTER clause ---
        let step1 = try await handler.invoke(
            input: ConnectorCallInvokeInput(
                stepRef: "step-kyc",
                connectorType: "http",
                operation: "POST /api/kyc/check",
                input: inputPayload,
                idempotencyKey: "idem-001"
            ),
            storage: storage
        )
        guard case .ok(let call, let stepRef) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }
        XCTAssertFalse(call.isEmpty)
        XCTAssertEqual(stepRef, "step-kyc")

        // --- THEN clause ---
        let step2 = try await handler.getResult(
            input: ConnectorCallGetResultInput(call: call),
            storage: storage
        )
        if case .ok(let resultCall, let status, _) = step2 {
            XCTAssertEqual(resultCall, call)
            XCTAssertEqual(status, "invoking")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testConnectorCallInvokeAndMarkSuccess() async throws {
        // invariant: after invoke then markSuccess, getResult returns succeeded status with output
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let inputPayload = Data("{\"order\":\"O1\"}".utf8)
        let outputPayload = Data("{\"orderId\":\"123\"}".utf8)

        // --- AFTER clause ---
        let step1 = try await handler.invoke(
            input: ConnectorCallInvokeInput(
                stepRef: "step-order",
                connectorType: "http",
                operation: "POST /api/orders",
                input: inputPayload,
                idempotencyKey: "idem-002"
            ),
            storage: storage
        )
        guard case .ok(let call, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.markSuccess(
            input: ConnectorCallMarkSuccessInput(call: call, output: outputPayload),
            storage: storage
        )
        if case .ok(let successCall, let successStepRef, _) = step2 {
            XCTAssertEqual(successCall, call)
            XCTAssertEqual(successStepRef, "step-order")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        // --- THEN clause ---
        let step3 = try await handler.getResult(
            input: ConnectorCallGetResultInput(call: call),
            storage: storage
        )
        if case .ok(_, let status, _) = step3 {
            XCTAssertEqual(status, "succeeded")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    func testConnectorCallInvokeAndMarkFailure() async throws {
        // invariant: after invoke then markFailure, getResult returns failed status
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let inputPayload = Data("{\"payment\":\"P1\"}".utf8)

        let step1 = try await handler.invoke(
            input: ConnectorCallInvokeInput(
                stepRef: "step-pay",
                connectorType: "grpc",
                operation: "PaymentService.Charge",
                input: inputPayload,
                idempotencyKey: "idem-003"
            ),
            storage: storage
        )
        guard case .ok(let call, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.markFailure(
            input: ConnectorCallMarkFailureInput(call: call, error: "Connection timed out"),
            storage: storage
        )
        if case .error(let failCall, let failStepRef, _) = step2 {
            XCTAssertEqual(failCall, call)
            XCTAssertEqual(failStepRef, "step-pay")
        } else {
            XCTFail("Expected .error, got \(step2)")
        }

        // --- THEN clause ---
        let step3 = try await handler.getResult(
            input: ConnectorCallGetResultInput(call: call),
            storage: storage
        )
        if case .ok(_, let status, _) = step3 {
            XCTAssertEqual(status, "failed")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    func testConnectorCallDuplicateIdempotencyKey() async throws {
        // invariant: invoking with the same idempotency key returns duplicate
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let inputPayload = Data("{\"data\":\"D1\"}".utf8)

        let step1 = try await handler.invoke(
            input: ConnectorCallInvokeInput(
                stepRef: "step-dup",
                connectorType: "http",
                operation: "POST /api/check",
                input: inputPayload,
                idempotencyKey: "idem-dup-001"
            ),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        // --- THEN clause ---
        let step2 = try await handler.invoke(
            input: ConnectorCallInvokeInput(
                stepRef: "step-dup",
                connectorType: "http",
                operation: "POST /api/check",
                input: inputPayload,
                idempotencyKey: "idem-dup-001"
            ),
            storage: storage
        )
        if case .duplicate(let key) = step2 {
            XCTAssertEqual(key, "idem-dup-001")
        } else {
            XCTFail("Expected .duplicate, got \(step2)")
        }
    }

}
