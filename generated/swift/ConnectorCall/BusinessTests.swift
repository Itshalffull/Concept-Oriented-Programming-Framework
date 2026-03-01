// generated: ConnectorCall/BusinessTests.swift

import XCTest
@testable import Clef

final class ConnectorCallBusinessTests: XCTestCase {

    // MARK: - getResult after markSuccess contains output

    func testGetResultAfterMarkSuccessContainsOutput() async throws {
        // After markSuccess with an output payload, getResult should return succeeded status
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let inputPayload = Data("{\"userId\":\"U1\"}".utf8)
        let outputPayload = Data("{\"verified\":true,\"score\":95}".utf8)

        let step1 = try await handler.invoke(
            input: ConnectorCallInvokeInput(
                stepRef: "step-verify",
                connectorType: "http",
                operation: "POST /api/verify",
                input: inputPayload,
                idempotencyKey: "idem-biz-001"
            ),
            storage: storage
        )
        guard case .ok(let call, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let _ = try await handler.markSuccess(
            input: ConnectorCallMarkSuccessInput(call: call, output: outputPayload),
            storage: storage
        )

        let step3 = try await handler.getResult(
            input: ConnectorCallGetResultInput(call: call),
            storage: storage
        )
        if case .ok(let resultCall, let status, let output) = step3 {
            XCTAssertEqual(resultCall, call)
            XCTAssertEqual(status, "succeeded")
            XCTAssertNotNil(output)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    // MARK: - Multiple calls with unique idempotency keys

    func testMultipleCallsWithUniqueIdempotencyKeys() async throws {
        // Multiple invocations with different idempotency keys should all succeed
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        var calls: [String] = []
        for i in 1...4 {
            let payload = Data("{\"item\":\(i)}".utf8)
            let result = try await handler.invoke(
                input: ConnectorCallInvokeInput(
                    stepRef: "step-batch",
                    connectorType: "http",
                    operation: "POST /api/process",
                    input: payload,
                    idempotencyKey: "unique-key-\(i)"
                ),
                storage: storage
            )
            guard case .ok(let call, _) = result else {
                XCTFail("Expected .ok, got \(result)")
                return
            }
            calls.append(call)
        }

        XCTAssertEqual(Set(calls).count, 4, "All call IDs should be unique")
    }

    // MARK: - Mark failure then getResult

    func testMarkFailureContainsErrorInGetResult() async throws {
        // After markFailure, getResult should reflect failed status
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let inputPayload = Data("{\"target\":\"service-x\"}".utf8)

        let step1 = try await handler.invoke(
            input: ConnectorCallInvokeInput(
                stepRef: "step-failing",
                connectorType: "grpc",
                operation: "ServiceX.Call",
                input: inputPayload,
                idempotencyKey: "idem-fail-001"
            ),
            storage: storage
        )
        guard case .ok(let call, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.markFailure(
            input: ConnectorCallMarkFailureInput(call: call, error: "503 Service Unavailable"),
            storage: storage
        )
        if case .error(let failCall, _, _) = step2 {
            XCTAssertEqual(failCall, call)
        } else {
            XCTFail("Expected .error, got \(step2)")
        }

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

    // MARK: - Different connector types

    func testDifferentConnectorTypes() async throws {
        // Invocations with different connector types should all be supported
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let connectorTypes = ["http", "grpc", "graphql", "soap"]
        for (i, ctype) in connectorTypes.enumerated() {
            let payload = Data("{\"type\":\"\(ctype)\"}".utf8)
            let result = try await handler.invoke(
                input: ConnectorCallInvokeInput(
                    stepRef: "step-\(ctype)",
                    connectorType: ctype,
                    operation: "\(ctype.uppercased()) /call",
                    input: payload,
                    idempotencyKey: "idem-type-\(i)"
                ),
                storage: storage
            )
            if case .ok(let call, let stepRef) = result {
                XCTAssertFalse(call.isEmpty)
                XCTAssertEqual(stepRef, "step-\(ctype)")
            } else {
                XCTFail("Expected .ok for connector type \(ctype), got \(result)")
            }
        }
    }

    // MARK: - Idempotency across different step refs

    func testDuplicateIdempotencyKeyAcrossInvocations() async throws {
        // Same idempotency key should return duplicate even with different parameters
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let payload1 = Data("{\"v\":1}".utf8)
        let payload2 = Data("{\"v\":2}".utf8)

        let step1 = try await handler.invoke(
            input: ConnectorCallInvokeInput(
                stepRef: "step-first",
                connectorType: "http",
                operation: "GET /first",
                input: payload1,
                idempotencyKey: "shared-idem-key"
            ),
            storage: storage
        )
        guard case .ok = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.invoke(
            input: ConnectorCallInvokeInput(
                stepRef: "step-second",
                connectorType: "http",
                operation: "GET /second",
                input: payload2,
                idempotencyKey: "shared-idem-key"
            ),
            storage: storage
        )
        if case .duplicate(let key) = step2 {
            XCTAssertEqual(key, "shared-idem-key")
        } else {
            XCTFail("Expected .duplicate, got \(step2)")
        }
    }

    // MARK: - Success and failure on different calls

    func testMixedSuccessAndFailureOnDifferentCalls() async throws {
        // Some calls succeed while others fail; each should maintain its own state
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let payloadA = Data("{\"a\":true}".utf8)
        let payloadB = Data("{\"b\":true}".utf8)

        let rA = try await handler.invoke(
            input: ConnectorCallInvokeInput(stepRef: "step-a", connectorType: "http", operation: "POST /a", input: payloadA, idempotencyKey: "mix-a"),
            storage: storage
        )
        guard case .ok(let callA, _) = rA else { XCTFail("Expected .ok"); return }

        let rB = try await handler.invoke(
            input: ConnectorCallInvokeInput(stepRef: "step-b", connectorType: "http", operation: "POST /b", input: payloadB, idempotencyKey: "mix-b"),
            storage: storage
        )
        guard case .ok(let callB, _) = rB else { XCTFail("Expected .ok"); return }

        let outputA = Data("{\"result\":\"ok\"}".utf8)
        let _ = try await handler.markSuccess(
            input: ConnectorCallMarkSuccessInput(call: callA, output: outputA),
            storage: storage
        )
        let _ = try await handler.markFailure(
            input: ConnectorCallMarkFailureInput(call: callB, error: "timeout"),
            storage: storage
        )

        let resultA = try await handler.getResult(input: ConnectorCallGetResultInput(call: callA), storage: storage)
        if case .ok(_, let status, _) = resultA {
            XCTAssertEqual(status, "succeeded")
        } else {
            XCTFail("Expected .ok, got \(resultA)")
        }

        let resultB = try await handler.getResult(input: ConnectorCallGetResultInput(call: callB), storage: storage)
        if case .ok(_, let status, _) = resultB {
            XCTAssertEqual(status, "failed")
        } else {
            XCTFail("Expected .ok, got \(resultB)")
        }
    }

    // MARK: - StepRef preserved through lifecycle

    func testStepRefPreservedThroughLifecycle() async throws {
        // The stepRef should be preserved and returned in markSuccess
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let inputPayload = Data("{\"data\":\"test\"}".utf8)
        let outputPayload = Data("{\"result\":\"success\"}".utf8)

        let step1 = try await handler.invoke(
            input: ConnectorCallInvokeInput(
                stepRef: "step-preserve-ref",
                connectorType: "http",
                operation: "POST /api/test",
                input: inputPayload,
                idempotencyKey: "idem-ref-001"
            ),
            storage: storage
        )
        guard case .ok(let call, let invokeStepRef) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }
        XCTAssertEqual(invokeStepRef, "step-preserve-ref")

        let step2 = try await handler.markSuccess(
            input: ConnectorCallMarkSuccessInput(call: call, output: outputPayload),
            storage: storage
        )
        if case .ok(let successCall, let successStepRef, _) = step2 {
            XCTAssertEqual(successCall, call)
            XCTAssertEqual(successStepRef, "step-preserve-ref")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    // MARK: - Large payload handling

    func testLargePayloadHandling() async throws {
        // Connector calls should handle larger payloads
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let largeString = String(repeating: "x", count: 10000)
        let inputPayload = Data("{\"data\":\"\(largeString)\"}".utf8)

        let step1 = try await handler.invoke(
            input: ConnectorCallInvokeInput(
                stepRef: "step-large",
                connectorType: "http",
                operation: "POST /api/bulk",
                input: inputPayload,
                idempotencyKey: "idem-large-001"
            ),
            storage: storage
        )
        if case .ok(let call, _) = step1 {
            XCTAssertFalse(call.isEmpty)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }
    }

}
