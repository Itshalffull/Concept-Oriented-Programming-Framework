// AuthorizationImpl.swift — Authorization concept implementation

import Foundation

// MARK: - Types

public struct AuthorizationGrantPermissionInput: Codable {
    public let roleId: String
    public let permissionId: String

    public init(roleId: String, permissionId: String) {
        self.roleId = roleId
        self.permissionId = permissionId
    }
}

public enum AuthorizationGrantPermissionOutput: Codable {
    case ok(roleId: String, permissionId: String)

    enum CodingKeys: String, CodingKey {
        case variant, roleId, permissionId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                roleId: try container.decode(String.self, forKey: .roleId),
                permissionId: try container.decode(String.self, forKey: .permissionId)
            )
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let roleId, let permissionId):
            try container.encode("ok", forKey: .variant)
            try container.encode(roleId, forKey: .roleId)
            try container.encode(permissionId, forKey: .permissionId)
        }
    }
}

public struct AuthorizationRevokePermissionInput: Codable {
    public let roleId: String
    public let permissionId: String

    public init(roleId: String, permissionId: String) {
        self.roleId = roleId
        self.permissionId = permissionId
    }
}

public enum AuthorizationRevokePermissionOutput: Codable {
    case ok(roleId: String, permissionId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, roleId, permissionId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                roleId: try container.decode(String.self, forKey: .roleId),
                permissionId: try container.decode(String.self, forKey: .permissionId)
            )
        case "notfound":
            self = .notfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let roleId, let permissionId):
            try container.encode("ok", forKey: .variant)
            try container.encode(roleId, forKey: .roleId)
            try container.encode(permissionId, forKey: .permissionId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct AuthorizationAssignRoleInput: Codable {
    public let userId: String
    public let roleId: String

    public init(userId: String, roleId: String) {
        self.userId = userId
        self.roleId = roleId
    }
}

public enum AuthorizationAssignRoleOutput: Codable {
    case ok(userId: String, roleId: String)

    enum CodingKeys: String, CodingKey {
        case variant, userId, roleId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                userId: try container.decode(String.self, forKey: .userId),
                roleId: try container.decode(String.self, forKey: .roleId)
            )
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let userId, let roleId):
            try container.encode("ok", forKey: .variant)
            try container.encode(userId, forKey: .userId)
            try container.encode(roleId, forKey: .roleId)
        }
    }
}

public struct AuthorizationCheckPermissionInput: Codable {
    public let userId: String
    public let permissionId: String

    public init(userId: String, permissionId: String) {
        self.userId = userId
        self.permissionId = permissionId
    }
}

public enum AuthorizationCheckPermissionOutput: Codable {
    case ok(allowed: Bool)

    enum CodingKeys: String, CodingKey {
        case variant, allowed
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(allowed: try container.decode(Bool.self, forKey: .allowed))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let allowed):
            try container.encode("ok", forKey: .variant)
            try container.encode(allowed, forKey: .allowed)
        }
    }
}

// MARK: - Handler Protocol

public protocol AuthorizationHandler {
    func grantPermission(input: AuthorizationGrantPermissionInput, storage: ConceptStorage) async throws -> AuthorizationGrantPermissionOutput
    func revokePermission(input: AuthorizationRevokePermissionInput, storage: ConceptStorage) async throws -> AuthorizationRevokePermissionOutput
    func assignRole(input: AuthorizationAssignRoleInput, storage: ConceptStorage) async throws -> AuthorizationAssignRoleOutput
    func checkPermission(input: AuthorizationCheckPermissionInput, storage: ConceptStorage) async throws -> AuthorizationCheckPermissionOutput
}

// MARK: - Implementation

public struct AuthorizationHandlerImpl: AuthorizationHandler {
    public init() {}

    public func grantPermission(
        input: AuthorizationGrantPermissionInput,
        storage: ConceptStorage
    ) async throws -> AuthorizationGrantPermissionOutput {
        let compKey = "\(input.roleId)::\(input.permissionId)"
        try await storage.put(
            relation: "permission",
            key: compKey,
            value: [
                "roleId": input.roleId,
                "permissionId": input.permissionId,
            ]
        )
        return .ok(roleId: input.roleId, permissionId: input.permissionId)
    }

    public func revokePermission(
        input: AuthorizationRevokePermissionInput,
        storage: ConceptStorage
    ) async throws -> AuthorizationRevokePermissionOutput {
        let compKey = "\(input.roleId)::\(input.permissionId)"
        guard try await storage.get(relation: "permission", key: compKey) != nil else {
            return .notfound(message: "Permission '\(input.permissionId)' not found on role '\(input.roleId)'")
        }
        try await storage.del(relation: "permission", key: compKey)
        return .ok(roleId: input.roleId, permissionId: input.permissionId)
    }

    public func assignRole(
        input: AuthorizationAssignRoleInput,
        storage: ConceptStorage
    ) async throws -> AuthorizationAssignRoleOutput {
        let compKey = "\(input.userId)::\(input.roleId)"
        try await storage.put(
            relation: "user_role",
            key: compKey,
            value: [
                "userId": input.userId,
                "roleId": input.roleId,
            ]
        )
        return .ok(userId: input.userId, roleId: input.roleId)
    }

    public func checkPermission(
        input: AuthorizationCheckPermissionInput,
        storage: ConceptStorage
    ) async throws -> AuthorizationCheckPermissionOutput {
        // Find all roles for this user
        let userRoles = try await storage.find(
            relation: "user_role",
            criteria: ["userId": input.userId]
        )
        // Check each role for the requested permission
        for userRole in userRoles {
            let roleId = userRole["roleId"] as? String ?? ""
            let compKey = "\(roleId)::\(input.permissionId)"
            if let _ = try await storage.get(relation: "permission", key: compKey) {
                return .ok(allowed: true)
            }
        }
        return .ok(allowed: false)
    }
}
