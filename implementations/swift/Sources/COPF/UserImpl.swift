// UserImpl.swift — User concept implementation

import Foundation

// MARK: - Types (matching generated User/Types.swift)

public struct UserRegisterInput: Codable {
    public let user: String
    public let name: String
    public let email: String

    public init(user: String, name: String, email: String) {
        self.user = user
        self.name = name
        self.email = email
    }
}

public enum UserRegisterOutput: Codable {
    case ok(user: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case user
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                user: try container.decode(String.self, forKey: .user)
            )
        case "error":
            self = .error(
                message: try container.decode(String.self, forKey: .message)
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
        case .ok(let user):
            try container.encode("ok", forKey: .variant)
            try container.encode(user, forKey: .user)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol (matching generated User/Handler.swift)

public protocol UserHandler {
    func register(
        input: UserRegisterInput,
        storage: ConceptStorage
    ) async throws -> UserRegisterOutput
}

// MARK: - Implementation

public struct UserHandlerImpl: UserHandler {
    public init() {}

    public func register(
        input: UserRegisterInput,
        storage: ConceptStorage
    ) async throws -> UserRegisterOutput {
        // Check uniqueness of name
        let existingByName = try await storage.find(
            relation: "user",
            criteria: ["name": input.name]
        )
        if !existingByName.isEmpty {
            return .error(message: "User with name '\(input.name)' already exists")
        }

        // Check uniqueness of email
        let existingByEmail = try await storage.find(
            relation: "user",
            criteria: ["email": input.email]
        )
        if !existingByEmail.isEmpty {
            return .error(message: "User with email '\(input.email)' already exists")
        }

        // Store user record
        try await storage.put(
            relation: "user",
            key: input.user,
            value: [
                "id": input.user,
                "name": input.name,
                "email": input.email,
            ]
        )

        return .ok(user: input.user)
    }
}
