// generated: Session/ConformanceTests.swift

import XCTest
@testable import COPF

final class SessionConformanceTests: XCTestCase {

    func testSessionInvariant1() async throws {
        // invariant 1: after create, validate behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let s = "u-test-invariant-001"
        let t = "u-test-invariant-002"

        // --- AFTER clause ---
        // create(session: s, userId: "alice", device: "mobile") -> ok(token: t)
        let step1 = try await handler.create(
            input: SessionCreateInput(session: s, userId: "alice", device: "mobile"),
            storage: storage
        )
        if case .ok(let token) = step1 {
            XCTAssertEqual(token, t)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // validate(session: s) -> ok(valid: true)
        let step2 = try await handler.validate(
            input: SessionValidateInput(session: s),
            storage: storage
        )
        if case .ok(let valid) = step2 {
            XCTAssertEqual(valid, true)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testSessionInvariant2() async throws {
        // invariant 2: after create, getContext behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let s = "u-test-invariant-001"
        let t = "u-test-invariant-002"

        // --- AFTER clause ---
        // create(session: s, userId: "alice", device: "mobile") -> ok(token: t)
        let step1 = try await handler.create(
            input: SessionCreateInput(session: s, userId: "alice", device: "mobile"),
            storage: storage
        )
        if case .ok(let token) = step1 {
            XCTAssertEqual(token, t)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // getContext(session: s) -> ok(userId: "alice", device: "mobile")
        let step2 = try await handler.getContext(
            input: SessionGetContextInput(session: s),
            storage: storage
        )
        if case .ok(let userId, let device) = step2 {
            XCTAssertEqual(userId, "alice")
            XCTAssertEqual(device, "mobile")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testSessionInvariant3() async throws {
        // invariant 3: after create, destroy, validate behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let s = "u-test-invariant-001"
        let t = "u-test-invariant-002"
        let m = "u-test-invariant-003"

        // --- AFTER clause ---
        // create(session: s, userId: "alice", device: "mobile") -> ok(token: t)
        let step1 = try await handler.create(
            input: SessionCreateInput(session: s, userId: "alice", device: "mobile"),
            storage: storage
        )
        if case .ok(let token) = step1 {
            XCTAssertEqual(token, t)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }
        // destroy(session: s) -> ok(session: s)
        let step2 = try await handler.destroy(
            input: SessionDestroyInput(session: s),
            storage: storage
        )
        if case .ok(let session) = step2 {
            XCTAssertEqual(session, s)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        // --- THEN clause ---
        // validate(session: s) -> notfound(message: m)
        let step3 = try await handler.validate(
            input: SessionValidateInput(session: s),
            storage: storage
        )
        if case .notfound(let message) = step3 {
            XCTAssertEqual(message, m)
        } else {
            XCTFail("Expected .notfound, got \(step3)")
        }
    }

    func testSessionInvariant4() async throws {
        // invariant 4: after create, create, destroyAll, validate behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let s1 = "u-test-invariant-001"
        let t1 = "u-test-invariant-002"
        let s2 = "u-test-invariant-003"
        let t2 = "u-test-invariant-004"
        let m1 = "u-test-invariant-005"

        // --- AFTER clause ---
        // create(session: s1, userId: "alice", device: "mobile") -> ok(token: t1)
        let step1 = try await handler.create(
            input: SessionCreateInput(session: s1, userId: "alice", device: "mobile"),
            storage: storage
        )
        if case .ok(let token) = step1 {
            XCTAssertEqual(token, t1)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }
        // create(session: s2, userId: "alice", device: "desktop") -> ok(token: t2)
        let step2 = try await handler.create(
            input: SessionCreateInput(session: s2, userId: "alice", device: "desktop"),
            storage: storage
        )
        if case .ok(let token) = step2 {
            XCTAssertEqual(token, t2)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
        // destroyAll(userId: "alice") -> ok(userId: "alice")
        let step3 = try await handler.destroyAll(
            input: SessionDestroyAllInput(userId: "alice"),
            storage: storage
        )
        if case .ok(let userId) = step3 {
            XCTAssertEqual(userId, "alice")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }

        // --- THEN clause ---
        // validate(session: s1) -> notfound(message: m1)
        let step4 = try await handler.validate(
            input: SessionValidateInput(session: s1),
            storage: storage
        )
        if case .notfound(let message) = step4 {
            XCTAssertEqual(message, m1)
        } else {
            XCTFail("Expected .notfound, got \(step4)")
        }
    }

}
