// FollowImpl.swift — Follow concept implementation

import Foundation

// MARK: - Types (matching generated Follow/Types.swift)

public struct FollowFollowInput: Codable {
    public let user: String
    public let target: String

    public init(user: String, target: String) {
        self.user = user
        self.target = target
    }
}

public enum FollowFollowOutput: Codable {
    case ok(user: String, target: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case user
        case target
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                user: try container.decode(String.self, forKey: .user),
                target: try container.decode(String.self, forKey: .target)
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
        case .ok(let user, let target):
            try container.encode("ok", forKey: .variant)
            try container.encode(user, forKey: .user)
            try container.encode(target, forKey: .target)
        }
    }
}

public struct FollowUnfollowInput: Codable {
    public let user: String
    public let target: String

    public init(user: String, target: String) {
        self.user = user
        self.target = target
    }
}

public enum FollowUnfollowOutput: Codable {
    case ok(user: String, target: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case user
        case target
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                user: try container.decode(String.self, forKey: .user),
                target: try container.decode(String.self, forKey: .target)
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
        case .ok(let user, let target):
            try container.encode("ok", forKey: .variant)
            try container.encode(user, forKey: .user)
            try container.encode(target, forKey: .target)
        }
    }
}

public struct FollowIsFollowingInput: Codable {
    public let user: String
    public let target: String

    public init(user: String, target: String) {
        self.user = user
        self.target = target
    }
}

public enum FollowIsFollowingOutput: Codable {
    case ok(following: Bool)

    enum CodingKeys: String, CodingKey {
        case variant
        case following
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                following: try container.decode(Bool.self, forKey: .following)
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
        case .ok(let following):
            try container.encode("ok", forKey: .variant)
            try container.encode(following, forKey: .following)
        }
    }
}

// MARK: - Handler Protocol (matching generated Follow/Handler.swift)

public protocol FollowHandler {
    func follow(
        input: FollowFollowInput,
        storage: ConceptStorage
    ) async throws -> FollowFollowOutput

    func unfollow(
        input: FollowUnfollowInput,
        storage: ConceptStorage
    ) async throws -> FollowUnfollowOutput

    func isFollowing(
        input: FollowIsFollowingInput,
        storage: ConceptStorage
    ) async throws -> FollowIsFollowingOutput
}

// MARK: - Implementation

public struct FollowHandlerImpl: FollowHandler {
    public init() {}

    public func follow(
        input: FollowFollowInput,
        storage: ConceptStorage
    ) async throws -> FollowFollowOutput {
        // Get user's following list
        let existing = try await storage.get(relation: "follow", key: input.user)
        var following: [String]
        if let existingRecord = existing, let existingFollowing = existingRecord["following"] as? [String] {
            following = existingFollowing
        } else {
            following = []
        }

        // Add target if not already present
        if !following.contains(input.target) {
            following.append(input.target)
        }

        try await storage.put(
            relation: "follow",
            key: input.user,
            value: [
                "user": input.user,
                "following": following,
            ]
        )

        return .ok(user: input.user, target: input.target)
    }

    public func unfollow(
        input: FollowUnfollowInput,
        storage: ConceptStorage
    ) async throws -> FollowUnfollowOutput {
        let existing = try await storage.get(relation: "follow", key: input.user)
        var following: [String]
        if let existingRecord = existing, let existingFollowing = existingRecord["following"] as? [String] {
            following = existingFollowing
        } else {
            following = []
        }

        // Remove target from following
        following = following.filter { $0 != input.target }

        try await storage.put(
            relation: "follow",
            key: input.user,
            value: [
                "user": input.user,
                "following": following,
            ]
        )

        return .ok(user: input.user, target: input.target)
    }

    public func isFollowing(
        input: FollowIsFollowingInput,
        storage: ConceptStorage
    ) async throws -> FollowIsFollowingOutput {
        let existing = try await storage.get(relation: "follow", key: input.user)
        if let existingRecord = existing, let existingFollowing = existingRecord["following"] as? [String] {
            return .ok(following: existingFollowing.contains(input.target))
        }
        return .ok(following: false)
    }
}
