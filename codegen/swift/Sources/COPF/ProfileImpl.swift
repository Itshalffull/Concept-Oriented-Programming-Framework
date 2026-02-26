// ProfileImpl.swift — Profile concept implementation

import Foundation

// MARK: - Types (matching generated Profile/Types.swift)

public struct ProfileUpdateInput: Codable {
    public let user: String
    public let bio: String
    public let image: String

    public init(user: String, bio: String, image: String) {
        self.user = user
        self.bio = bio
        self.image = image
    }
}

public enum ProfileUpdateOutput: Codable {
    case ok(user: String, bio: String, image: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case user
        case bio
        case image
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                user: try container.decode(String.self, forKey: .user),
                bio: try container.decode(String.self, forKey: .bio),
                image: try container.decode(String.self, forKey: .image)
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
        case .ok(let user, let bio, let image):
            try container.encode("ok", forKey: .variant)
            try container.encode(user, forKey: .user)
            try container.encode(bio, forKey: .bio)
            try container.encode(image, forKey: .image)
        }
    }
}

public struct ProfileGetInput: Codable {
    public let user: String

    public init(user: String) {
        self.user = user
    }
}

public enum ProfileGetOutput: Codable {
    case ok(user: String, bio: String, image: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case user
        case bio
        case image
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                user: try container.decode(String.self, forKey: .user),
                bio: try container.decode(String.self, forKey: .bio),
                image: try container.decode(String.self, forKey: .image)
            )
        case "notfound":
            self = .notfound(
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
        case .ok(let user, let bio, let image):
            try container.encode("ok", forKey: .variant)
            try container.encode(user, forKey: .user)
            try container.encode(bio, forKey: .bio)
            try container.encode(image, forKey: .image)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol (matching generated Profile/Handler.swift)

public protocol ProfileHandler {
    func update(
        input: ProfileUpdateInput,
        storage: ConceptStorage
    ) async throws -> ProfileUpdateOutput

    func get(
        input: ProfileGetInput,
        storage: ConceptStorage
    ) async throws -> ProfileGetOutput
}

// MARK: - Implementation

public struct ProfileHandlerImpl: ProfileHandler {
    public init() {}

    public func update(
        input: ProfileUpdateInput,
        storage: ConceptStorage
    ) async throws -> ProfileUpdateOutput {
        try await storage.put(
            relation: "profile",
            key: input.user,
            value: [
                "user": input.user,
                "bio": input.bio,
                "image": input.image,
            ]
        )

        return .ok(user: input.user, bio: input.bio, image: input.image)
    }

    public func get(
        input: ProfileGetInput,
        storage: ConceptStorage
    ) async throws -> ProfileGetOutput {
        guard let record = try await storage.get(relation: "profile", key: input.user) else {
            return .notfound(message: "Profile not found for user '\(input.user)'")
        }

        let bio = record["bio"] as? String ?? ""
        let image = record["image"] as? String ?? ""

        return .ok(user: input.user, bio: bio, image: image)
    }
}
