// generated: User/Types.swift

import Foundation

struct UserRegisterInput: Codable {
    let user: String
    let name: String
    let email: String
}

enum UserRegisterOutput: Codable {
    case ok(user: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case user
        case message
    }

    init(from decoder: Decoder) throws {
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
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
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

