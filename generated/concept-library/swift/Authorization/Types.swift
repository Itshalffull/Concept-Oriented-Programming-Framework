// generated: Authorization/Types.swift

import Foundation

struct AuthorizationGrantPermissionInput: Codable {
    let role: String
    let permission: String
}

enum AuthorizationGrantPermissionOutput: Codable {
    case ok(role: String, permission: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case role
        case permission
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                role: try container.decode(String.self, forKey: .role),
                permission: try container.decode(String.self, forKey: .permission)
            )
        case "notfound":
            self = .notfound(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let role, let permission):
            try container.encode("ok", forKey: .variant)
            try container.encode(role, forKey: .role)
            try container.encode(permission, forKey: .permission)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct AuthorizationRevokePermissionInput: Codable {
    let role: String
    let permission: String
}

enum AuthorizationRevokePermissionOutput: Codable {
    case ok(role: String, permission: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case role
        case permission
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                role: try container.decode(String.self, forKey: .role),
                permission: try container.decode(String.self, forKey: .permission)
            )
        case "notfound":
            self = .notfound(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let role, let permission):
            try container.encode("ok", forKey: .variant)
            try container.encode(role, forKey: .role)
            try container.encode(permission, forKey: .permission)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct AuthorizationAssignRoleInput: Codable {
    let user: String
    let role: String
}

enum AuthorizationAssignRoleOutput: Codable {
    case ok(user: String, role: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case user
        case role
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                user: try container.decode(String.self, forKey: .user),
                role: try container.decode(String.self, forKey: .role)
            )
        case "notfound":
            self = .notfound(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let user, let role):
            try container.encode("ok", forKey: .variant)
            try container.encode(user, forKey: .user)
            try container.encode(role, forKey: .role)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct AuthorizationCheckPermissionInput: Codable {
    let user: String
    let permission: String
}

enum AuthorizationCheckPermissionOutput: Codable {
    case ok(granted: Bool)

    enum CodingKeys: String, CodingKey {
        case variant
        case granted
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                granted: try container.decode(Bool.self, forKey: .granted)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let granted):
            try container.encode("ok", forKey: .variant)
            try container.encode(granted, forKey: .granted)
        }
    }
}

