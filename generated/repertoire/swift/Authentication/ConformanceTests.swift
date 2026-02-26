// generated: Authentication/ConformanceTests.swift

import XCTest
@testable import COPF

final class AuthenticationConformanceTests: XCTestCase {

    func testAuthenticationInvariant1() async throws {
        // invariant 1: after register, login behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let x = "u-test-invariant-001"
        let t = "u-test-invariant-002"

        // --- AFTER clause ---
        // register(user: x, provider: "local", credentials: "secret123") -> ok(user: x)
        let step1 = try await handler.register(
            input: AuthenticationRegisterInput(user: x, provider: "local", credentials: "secret123"),
            storage: storage
        )
        if case .ok(let user) = step1 {
            XCTAssertEqual(user, x)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // login(user: x, credentials: "secret123") -> ok(token: t)
        let step2 = try await handler.login(
            input: AuthenticationLoginInput(user: x, credentials: "secret123"),
            storage: storage
        )
        if case .ok(let token) = step2 {
            XCTAssertEqual(token, t)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testAuthenticationInvariant2() async throws {
        // invariant 2: after register, login, authenticate behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let x = "u-test-invariant-001"
        let t = "u-test-invariant-002"

        // --- AFTER clause ---
        // register(user: x, provider: "local", credentials: "secret123") -> ok(user: x)
        let step1 = try await handler.register(
            input: AuthenticationRegisterInput(user: x, provider: "local", credentials: "secret123"),
            storage: storage
        )
        if case .ok(let user) = step1 {
            XCTAssertEqual(user, x)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }
        // login(user: x, credentials: "secret123") -> ok(token: t)
        let step2 = try await handler.login(
            input: AuthenticationLoginInput(user: x, credentials: "secret123"),
            storage: storage
        )
        if case .ok(let token) = step2 {
            XCTAssertEqual(token, t)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        // --- THEN clause ---
        // authenticate(token: t) -> ok(user: x)
        let step3 = try await handler.authenticate(
            input: AuthenticationAuthenticateInput(token: t),
            storage: storage
        )
        if case .ok(let user) = step3 {
            XCTAssertEqual(user, x)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    func testAuthenticationInvariant3() async throws {
        // invariant 3: after register, register behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let x = "u-test-invariant-001"
        let m = "u-test-invariant-002"

        // --- AFTER clause ---
        // register(user: x, provider: "local", credentials: "secret123") -> ok(user: x)
        let step1 = try await handler.register(
            input: AuthenticationRegisterInput(user: x, provider: "local", credentials: "secret123"),
            storage: storage
        )
        if case .ok(let user) = step1 {
            XCTAssertEqual(user, x)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }

        // --- THEN clause ---
        // register(user: x, provider: "oauth", credentials: "token456") -> exists(message: m)
        let step2 = try await handler.register(
            input: AuthenticationRegisterInput(user: x, provider: "oauth", credentials: "token456"),
            storage: storage
        )
        if case .exists(let message) = step2 {
            XCTAssertEqual(message, m)
        } else {
            XCTFail("Expected .exists, got \(step2)")
        }
    }

    func testAuthenticationInvariant4() async throws {
        // invariant 4: after register, resetPassword, login behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let x = "u-test-invariant-001"
        let m = "u-test-invariant-002"

        // --- AFTER clause ---
        // register(user: x, provider: "local", credentials: "secret123") -> ok(user: x)
        let step1 = try await handler.register(
            input: AuthenticationRegisterInput(user: x, provider: "local", credentials: "secret123"),
            storage: storage
        )
        if case .ok(let user) = step1 {
            XCTAssertEqual(user, x)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }
        // resetPassword(user: x, newCredentials: "newpass456") -> ok(user: x)
        let step2 = try await handler.resetPassword(
            input: AuthenticationResetPasswordInput(user: x, newCredentials: "newpass456"),
            storage: storage
        )
        if case .ok(let user) = step2 {
            XCTAssertEqual(user, x)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        // --- THEN clause ---
        // login(user: x, credentials: "secret123") -> invalid(message: m)
        let step3 = try await handler.login(
            input: AuthenticationLoginInput(user: x, credentials: "secret123"),
            storage: storage
        )
        if case .invalid(let message) = step3 {
            XCTAssertEqual(message, m)
        } else {
            XCTFail("Expected .invalid, got \(step3)")
        }
    }

}
