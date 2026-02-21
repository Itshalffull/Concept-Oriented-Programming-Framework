// AuthorizationTests.swift — Tests for Authorization concept

import XCTest
@testable import COPF

final class AuthorizationTests: XCTestCase {

    // MARK: - grantPermission

    func testGrantPermissionReturnsOk() async throws {
        let storage = InMemoryStorage()
        let handler = AuthorizationHandlerImpl()

        let result = try await handler.grantPermission(
            input: AuthorizationGrantPermissionInput(roleId: "admin", permissionId: "read"),
            storage: storage
        )

        if case .ok(let roleId, let permissionId) = result {
            XCTAssertEqual(roleId, "admin")
            XCTAssertEqual(permissionId, "read")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGrantPermissionStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = AuthorizationHandlerImpl()

        _ = try await handler.grantPermission(
            input: AuthorizationGrantPermissionInput(roleId: "editor", permissionId: "write"),
            storage: storage
        )

        let record = try await storage.get(relation: "permission", key: "editor::write")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["roleId"] as? String, "editor")
    }

    func testGrantMultiplePermissions() async throws {
        let storage = InMemoryStorage()
        let handler = AuthorizationHandlerImpl()

        _ = try await handler.grantPermission(
            input: AuthorizationGrantPermissionInput(roleId: "admin", permissionId: "read"),
            storage: storage
        )
        _ = try await handler.grantPermission(
            input: AuthorizationGrantPermissionInput(roleId: "admin", permissionId: "write"),
            storage: storage
        )

        let r1 = try await storage.get(relation: "permission", key: "admin::read")
        let r2 = try await storage.get(relation: "permission", key: "admin::write")
        XCTAssertNotNil(r1)
        XCTAssertNotNil(r2)
    }

    // MARK: - revokePermission

    func testRevokePermissionReturnsOk() async throws {
        let storage = InMemoryStorage()
        let handler = AuthorizationHandlerImpl()

        _ = try await handler.grantPermission(
            input: AuthorizationGrantPermissionInput(roleId: "admin", permissionId: "delete"),
            storage: storage
        )

        let result = try await handler.revokePermission(
            input: AuthorizationRevokePermissionInput(roleId: "admin", permissionId: "delete"),
            storage: storage
        )

        if case .ok(let roleId, let permissionId) = result {
            XCTAssertEqual(roleId, "admin")
            XCTAssertEqual(permissionId, "delete")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testRevokePermissionNotFoundReturnsNotfound() async throws {
        let storage = InMemoryStorage()
        let handler = AuthorizationHandlerImpl()

        let result = try await handler.revokePermission(
            input: AuthorizationRevokePermissionInput(roleId: "admin", permissionId: "missing"),
            storage: storage
        )

        if case .notfound = result {
            // expected
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - assignRole

    func testAssignRoleReturnsOk() async throws {
        let storage = InMemoryStorage()
        let handler = AuthorizationHandlerImpl()

        let result = try await handler.assignRole(
            input: AuthorizationAssignRoleInput(userId: "user1", roleId: "admin"),
            storage: storage
        )

        if case .ok(let userId, let roleId) = result {
            XCTAssertEqual(userId, "user1")
            XCTAssertEqual(roleId, "admin")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testAssignRoleStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = AuthorizationHandlerImpl()

        _ = try await handler.assignRole(
            input: AuthorizationAssignRoleInput(userId: "user1", roleId: "editor"),
            storage: storage
        )

        let record = try await storage.get(relation: "user_role", key: "user1::editor")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["userId"] as? String, "user1")
    }

    // MARK: - checkPermission

    func testCheckPermissionAllowedWithRole() async throws {
        let storage = InMemoryStorage()
        let handler = AuthorizationHandlerImpl()

        _ = try await handler.grantPermission(
            input: AuthorizationGrantPermissionInput(roleId: "admin", permissionId: "read"),
            storage: storage
        )
        _ = try await handler.assignRole(
            input: AuthorizationAssignRoleInput(userId: "user1", roleId: "admin"),
            storage: storage
        )

        let result = try await handler.checkPermission(
            input: AuthorizationCheckPermissionInput(userId: "user1", permissionId: "read"),
            storage: storage
        )

        if case .ok(let allowed) = result {
            XCTAssertTrue(allowed)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCheckPermissionDeniedWithoutRole() async throws {
        let storage = InMemoryStorage()
        let handler = AuthorizationHandlerImpl()

        let result = try await handler.checkPermission(
            input: AuthorizationCheckPermissionInput(userId: "user1", permissionId: "delete"),
            storage: storage
        )

        if case .ok(let allowed) = result {
            XCTAssertFalse(allowed)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testCheckPermissionDeniedWithRoleButMissingPermission() async throws {
        let storage = InMemoryStorage()
        let handler = AuthorizationHandlerImpl()

        _ = try await handler.assignRole(
            input: AuthorizationAssignRoleInput(userId: "user1", roleId: "viewer"),
            storage: storage
        )

        let result = try await handler.checkPermission(
            input: AuthorizationCheckPermissionInput(userId: "user1", permissionId: "write"),
            storage: storage
        )

        if case .ok(let allowed) = result {
            XCTAssertFalse(allowed)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}
