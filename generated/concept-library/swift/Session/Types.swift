// generated: Session/Types.swift

import Foundation

struct SessionCreateInput: Codable {
    let session: String
    let userId: String
    let device: String
}

enum SessionCreateOutput: Codable {
    case ok(token: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case token
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                token: try container.decode(String.self, forKey: .token)
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
        case .ok(let token):
            try container.encode("ok", forKey: .variant)
            try container.encode(token, forKey: .token)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct SessionValidateInput: Codable {
    let session: String
}

enum SessionValidateOutput: Codable {
    case ok(valid: Bool)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case valid
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                valid: try container.decode(Bool.self, forKey: .valid)
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
        case .ok(let valid):
            try container.encode("ok", forKey: .variant)
            try container.encode(valid, forKey: .valid)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct SessionRefreshInput: Codable {
    let session: String
}

enum SessionRefreshOutput: Codable {
    case ok(token: String)
    case notfound(message: String)
    case expired(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case token
        case message
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                token: try container.decode(String.self, forKey: .token)
            )
        case "notfound":
            self = .notfound(
                message: try container.decode(String.self, forKey: .message)
            )
        case "expired":
            self = .expired(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let token):
            try container.encode("ok", forKey: .variant)
            try container.encode(token, forKey: .token)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        case .expired(let message):
            try container.encode("expired", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct SessionDestroyInput: Codable {
    let session: String
}

enum SessionDestroyOutput: Codable {
    case ok(session: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case session
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                session: try container.decode(String.self, forKey: .session)
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
        case .ok(let session):
            try container.encode("ok", forKey: .variant)
            try container.encode(session, forKey: .session)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct SessionDestroyAllInput: Codable {
    let userId: String
}

enum SessionDestroyAllOutput: Codable {
    case ok(userId: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case userId
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                userId: try container.decode(String.self, forKey: .userId)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let userId):
            try container.encode("ok", forKey: .variant)
            try container.encode(userId, forKey: .userId)
        }
    }
}

struct SessionGetContextInput: Codable {
    let session: String
}

enum SessionGetContextOutput: Codable {
    case ok(userId: String, device: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case userId
        case device
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                userId: try container.decode(String.self, forKey: .userId),
                device: try container.decode(String.self, forKey: .device)
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
        case .ok(let userId, let device):
            try container.encode("ok", forKey: .variant)
            try container.encode(userId, forKey: .userId)
            try container.encode(device, forKey: .device)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

