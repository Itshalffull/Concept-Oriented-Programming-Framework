// generated: Registry/Types.swift

import Foundation

struct RegistryRegisterInput: Codable {
    let uri: String
    let transport: Any
}

enum RegistryRegisterOutput: Codable {
    case ok(concept: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case concept
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                concept: try container.decode(String.self, forKey: .concept)
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
        case .ok(let concept):
            try container.encode("ok", forKey: .variant)
            try container.encode(concept, forKey: .concept)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct RegistryDeregisterInput: Codable {
    let uri: String
}

enum RegistryDeregisterOutput: Codable {
    case ok

    enum CodingKeys: String, CodingKey {
        case variant
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok": self = .ok
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok:
            try container.encode("ok", forKey: .variant)
        }
    }
}

struct RegistryHeartbeatInput: Codable {
    let uri: String
}

enum RegistryHeartbeatOutput: Codable {
    case ok(available: Bool)

    enum CodingKeys: String, CodingKey {
        case variant
        case available
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                available: try container.decode(Bool.self, forKey: .available)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let available):
            try container.encode("ok", forKey: .variant)
            try container.encode(available, forKey: .available)
        }
    }
}

