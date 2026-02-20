// generated: Follow/Types.swift

import Foundation

struct FollowFollowInput: Codable {
    let user: String
    let target: String
}

enum FollowFollowOutput: Codable {
    case ok(user: String, target: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case user
        case target
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                user: try container.decode(String.self, forKey: .user),
                target: try container.decode(String.self, forKey: .target)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let user, let target):
            try container.encode("ok", forKey: .variant)
            try container.encode(user, forKey: .user)
            try container.encode(target, forKey: .target)
        }
    }
}

struct FollowUnfollowInput: Codable {
    let user: String
    let target: String
}

enum FollowUnfollowOutput: Codable {
    case ok(user: String, target: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case user
        case target
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                user: try container.decode(String.self, forKey: .user),
                target: try container.decode(String.self, forKey: .target)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let user, let target):
            try container.encode("ok", forKey: .variant)
            try container.encode(user, forKey: .user)
            try container.encode(target, forKey: .target)
        }
    }
}

struct FollowIsFollowingInput: Codable {
    let user: String
    let target: String
}

enum FollowIsFollowingOutput: Codable {
    case ok(following: Bool)

    enum CodingKeys: String, CodingKey {
        case variant
        case following
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                following: try container.decode(Bool.self, forKey: .following)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let following):
            try container.encode("ok", forKey: .variant)
            try container.encode(following, forKey: .following)
        }
    }
}

