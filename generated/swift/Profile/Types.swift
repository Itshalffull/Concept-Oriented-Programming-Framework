// generated: Profile/Types.swift

import Foundation

struct ProfileUpdateInput: Codable {
    let user: String
    let bio: String
    let image: String
}

enum ProfileUpdateOutput: Codable {
    case ok(user: String, bio: String, image: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case user
        case bio
        case image
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                user: try container.decode(String.self, forKey: .user),
                bio: try container.decode(String.self, forKey: .bio),
                image: try container.decode(String.self, forKey: .image)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
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

struct ProfileGetInput: Codable {
    let user: String
}

enum ProfileGetOutput: Codable {
    case ok(user: String, bio: String, image: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case user
        case bio
        case image
        case message
    }

    init(from decoder: Decoder) throws {
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
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
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

