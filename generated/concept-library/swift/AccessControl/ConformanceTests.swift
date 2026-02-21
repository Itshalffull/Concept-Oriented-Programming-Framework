// generated: AccessControl/ConformanceTests.swift

import XCTest
@testable import COPF

final class AccessControlConformanceTests: XCTestCase {

    func testAccessControlInvariant1() async throws {
        // invariant 1: after check, check, andIf behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let t = "u-test-invariant-001"
        let t2 = "u-test-invariant-002"

        // --- AFTER clause ---
        // check(resource: "document:123", action: "read", context: "user:alice") -> ok(result: "allowed", tags: t, maxAge: 300)
        let step1 = try await handler.check(
            input: AccessControlCheckInput(resource: "document:123", action: "read", context: "user:alice"),
            storage: storage
        )
        if case .ok(let result, let tags, let maxAge) = step1 {
            XCTAssertEqual(result, "allowed")
            XCTAssertEqual(tags, t)
            XCTAssertEqual(maxAge, 300)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }
        // check(resource: "document:123", action: "delete", context: "user:alice") -> ok(result: "forbidden", tags: t2, maxAge: 60)
        let step2 = try await handler.check(
            input: AccessControlCheckInput(resource: "document:123", action: "delete", context: "user:alice"),
            storage: storage
        )
        if case .ok(let result, let tags, let maxAge) = step2 {
            XCTAssertEqual(result, "forbidden")
            XCTAssertEqual(tags, t2)
            XCTAssertEqual(maxAge, 60)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        // --- THEN clause ---
        // andIf(left: "allowed", right: "forbidden") -> ok(result: "forbidden")
        let step3 = try await handler.andIf(
            input: AccessControlAndIfInput(left: "allowed", right: "forbidden"),
            storage: storage
        )
        if case .ok(let result) = step3 {
            XCTAssertEqual(result, "forbidden")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    func testAccessControlInvariant2() async throws {
        // invariant 2: after orIf, andIf behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        // --- AFTER clause ---
        // orIf(left: "neutral", right: "allowed") -> ok(result: "allowed")
        let step1 = try await handler.orIf(
            input: AccessControlOrIfInput(left: "neutral", right: "allowed"),
            storage: storage
        )
        if case .ok(let result) = step1 {
            XCTAssertEqual(result, "allowed")
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // andIf(left: "allowed", right: "allowed") -> ok(result: "allowed")
        let step2 = try await handler.andIf(
            input: AccessControlAndIfInput(left: "allowed", right: "allowed"),
            storage: storage
        )
        if case .ok(let result) = step2 {
            XCTAssertEqual(result, "allowed")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testAccessControlInvariant3() async throws {
        // invariant 3: after orIf, andIf behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        // --- AFTER clause ---
        // orIf(left: "neutral", right: "neutral") -> ok(result: "neutral")
        let step1 = try await handler.orIf(
            input: AccessControlOrIfInput(left: "neutral", right: "neutral"),
            storage: storage
        )
        if case .ok(let result) = step1 {
            XCTAssertEqual(result, "neutral")
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // andIf(left: "neutral", right: "neutral") -> ok(result: "neutral")
        let step2 = try await handler.andIf(
            input: AccessControlAndIfInput(left: "neutral", right: "neutral"),
            storage: storage
        )
        if case .ok(let result) = step2 {
            XCTAssertEqual(result, "neutral")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

}
