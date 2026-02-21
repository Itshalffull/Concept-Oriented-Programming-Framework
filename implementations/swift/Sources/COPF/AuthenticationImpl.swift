// AuthenticationImpl.swift — Authentication concept implementation

import Foundation

// MARK: - Types

public struct AuthenticationRegisterInput: Codable {
    public let userId: String
    public let credentials: String

    public init(userId: String, credentials: String) {
        self.userId = userId
        self.credentials = credentials
    }
}

public enum AuthenticationRegisterOutput: Codable {
    case ok(userId: String)
    case alreadyExists(userId: String)

    enum CodingKeys: String, CodingKey {
        case variant, userId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(userId: try container.decode(String.self, forKey: .userId))
        case "alreadyExists":
            self = .alreadyExists(userId: try container.decode(String.self, forKey: .userId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let userId):
            try container.encode("ok", forKey: .variant)
            try container.encode(userId, forKey: .userId)
        case .alreadyExists(let userId):
            try container.encode("alreadyExists", forKey: .variant)
            try container.encode(userId, forKey: .userId)
        }
    }
}

public struct AuthenticationLoginInput: Codable {
    public let userId: String
    public let credentials: String

    public init(userId: String, credentials: String) {
        self.userId = userId
        self.credentials = credentials
    }
}

public enum AuthenticationLoginOutput: Codable {
    case ok(userId: String, token: String)
    case invalidCredentials(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, userId, token, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                userId: try container.decode(String.self, forKey: .userId),
                token: try container.decode(String.self, forKey: .token)
            )
        case "invalidCredentials":
            self = .invalidCredentials(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let userId, let token):
            try container.encode("ok", forKey: .variant)
            try container.encode(userId, forKey: .userId)
            try container.encode(token, forKey: .token)
        case .invalidCredentials(let message):
            try container.encode("invalidCredentials", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct AuthenticationLogoutInput: Codable {
    public let userId: String

    public init(userId: String) {
        self.userId = userId
    }
}

public enum AuthenticationLogoutOutput: Codable {
    case ok(userId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, userId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(userId: try container.decode(String.self, forKey: .userId))
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
        case .ok(let userId):
            try container.encode("ok", forKey: .variant)
            try container.encode(userId, forKey: .userId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct AuthenticationResetPasswordInput: Codable {
    public let userId: String

    public init(userId: String) {
        self.userId = userId
    }
}

public enum AuthenticationResetPasswordOutput: Codable {
    case ok(userId: String, resetToken: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, userId, resetToken, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                userId: try container.decode(String.self, forKey: .userId),
                resetToken: try container.decode(String.self, forKey: .resetToken)
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
        case .ok(let userId, let resetToken):
            try container.encode("ok", forKey: .variant)
            try container.encode(userId, forKey: .userId)
            try container.encode(resetToken, forKey: .resetToken)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol AuthenticationHandler {
    func register(input: AuthenticationRegisterInput, storage: ConceptStorage) async throws -> AuthenticationRegisterOutput
    func login(input: AuthenticationLoginInput, storage: ConceptStorage) async throws -> AuthenticationLoginOutput
    func logout(input: AuthenticationLogoutInput, storage: ConceptStorage) async throws -> AuthenticationLogoutOutput
    func resetPassword(input: AuthenticationResetPasswordInput, storage: ConceptStorage) async throws -> AuthenticationResetPasswordOutput
}

// MARK: - Implementation

public struct AuthenticationHandlerImpl: AuthenticationHandler {
    public init() {}

    private func iso8601Now() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: Date())
    }

    public func register(
        input: AuthenticationRegisterInput,
        storage: ConceptStorage
    ) async throws -> AuthenticationRegisterOutput {
        if let _ = try await storage.get(relation: "account", key: input.userId) {
            return .alreadyExists(userId: input.userId)
        }
        let now = iso8601Now()
        try await storage.put(
            relation: "account",
            key: input.userId,
            value: [
                "userId": input.userId,
                "credentials": input.credentials,
                "createdAt": now,
                "updatedAt": now,
            ]
        )
        return .ok(userId: input.userId)
    }

    public func login(
        input: AuthenticationLoginInput,
        storage: ConceptStorage
    ) async throws -> AuthenticationLoginOutput {
        guard let record = try await storage.get(relation: "account", key: input.userId) else {
            return .invalidCredentials(message: "Invalid credentials for user '\(input.userId)'")
        }
        let storedCredentials = record["credentials"] as? String ?? ""
        guard storedCredentials == input.credentials else {
            return .invalidCredentials(message: "Invalid credentials for user '\(input.userId)'")
        }
        let token = UUID().uuidString
        return .ok(userId: input.userId, token: token)
    }

    public func logout(
        input: AuthenticationLogoutInput,
        storage: ConceptStorage
    ) async throws -> AuthenticationLogoutOutput {
        guard try await storage.get(relation: "account", key: input.userId) != nil else {
            return .notfound(message: "Account '\(input.userId)' not found")
        }
        return .ok(userId: input.userId)
    }

    public func resetPassword(
        input: AuthenticationResetPasswordInput,
        storage: ConceptStorage
    ) async throws -> AuthenticationResetPasswordOutput {
        guard try await storage.get(relation: "account", key: input.userId) != nil else {
            return .notfound(message: "Account '\(input.userId)' not found")
        }
        let resetToken = UUID().uuidString
        return .ok(userId: input.userId, resetToken: resetToken)
    }
}
