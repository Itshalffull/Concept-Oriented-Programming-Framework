// generated: Authorization/ConformanceTests.swift

import XCTest
@testable import COPF

final class AuthorizationConformanceTests: XCTestCase {

    func testAuthorizationInvariant1() async throws {
        // invariant 1: after grantPermission, assignRole, checkPermission behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let x = "u-test-invariant-001"

        // --- AFTER clause ---
        // grantPermission(role: "admin", permission: "write") -> ok(role: "admin", permission: "write")
        let step1 = try await handler.grantPermission(
            input: AuthorizationGrantPermissionInput(role: "admin", permission: "write"),
            storage: storage
        )
        if case .ok(let role, let permission) = step1 {
            XCTAssertEqual(role, "admin")
            XCTAssertEqual(permission, "write")
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }
        // assignRole(user: x, role: "admin") -> ok(user: x, role: "admin")
        let step2 = try await handler.assignRole(
            input: AuthorizationAssignRoleInput(user: x, role: "admin"),
            storage: storage
        )
        if case .ok(let user, let role) = step2 {
            XCTAssertEqual(user, x)
            XCTAssertEqual(role, "admin")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        // --- THEN clause ---
        // checkPermission(user: x, permission: "write") -> ok(granted: true)
        let step3 = try await handler.checkPermission(
            input: AuthorizationCheckPermissionInput(user: x, permission: "write"),
            storage: storage
        )
        if case .ok(let granted) = step3 {
            XCTAssertEqual(granted, true)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    func testAuthorizationInvariant2() async throws {
        // invariant 2: after grantPermission, assignRole, revokePermission, checkPermission behaves correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let x = "u-test-invariant-001"

        // --- AFTER clause ---
        // grantPermission(role: "editor", permission: "publish") -> ok(role: "editor", permission: "publish")
        let step1 = try await handler.grantPermission(
            input: AuthorizationGrantPermissionInput(role: "editor", permission: "publish"),
            storage: storage
        )
        if case .ok(let role, let permission) = step1 {
            XCTAssertEqual(role, "editor")
            XCTAssertEqual(permission, "publish")
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }
        // assignRole(user: x, role: "editor") -> ok(user: x, role: "editor")
        let step2 = try await handler.assignRole(
            input: AuthorizationAssignRoleInput(user: x, role: "editor"),
            storage: storage
        )
        if case .ok(let user, let role) = step2 {
            XCTAssertEqual(user, x)
            XCTAssertEqual(role, "editor")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
        // revokePermission(role: "editor", permission: "publish") -> ok(role: "editor", permission: "publish")
        let step3 = try await handler.revokePermission(
            input: AuthorizationRevokePermissionInput(role: "editor", permission: "publish"),
            storage: storage
        )
        if case .ok(let role, let permission) = step3 {
            XCTAssertEqual(role, "editor")
            XCTAssertEqual(permission, "publish")
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }

        // --- THEN clause ---
        // checkPermission(user: x, permission: "publish") -> ok(granted: false)
        let step4 = try await handler.checkPermission(
            input: AuthorizationCheckPermissionInput(user: x, permission: "publish"),
            storage: storage
        )
        if case .ok(let granted) = step4 {
            XCTAssertEqual(granted, false)
        } else {
            XCTFail("Expected .ok, got \(step4)")
        }
    }

}
