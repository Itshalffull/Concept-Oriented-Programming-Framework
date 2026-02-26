// generated: Property/Types.swift

import Foundation

struct PropertySetInput: Codable {
    let entity: String
    let key: String
    let value: String
}

enum PropertySetOutput: Codable {
    case ok(entity: String)
    case invalid(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case entity
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                entity: try container.decode(String.self, forKey: .entity)
            )
        case "invalid":
            self = .invalid(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let entity):
            try container.encode("ok", forKey: .variant)
            try container.encode(entity, forKey: .entity)
        case .invalid(let message):
            try container.encode("invalid", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct PropertyGetInput: Codable {
    let entity: String
    let key: String
}

enum PropertyGetOutput: Codable {
    case ok(value: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case value
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                value: try container.decode(String.self, forKey: .value)
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
        case .ok(let value):
            try container.encode("ok", forKey: .variant)
            try container.encode(value, forKey: .value)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct PropertyDeleteInput: Codable {
    let entity: String
    let key: String
}

enum PropertyDeleteOutput: Codable {
    case ok(entity: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case entity
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                entity: try container.decode(String.self, forKey: .entity)
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
        case .ok(let entity):
            try container.encode("ok", forKey: .variant)
            try container.encode(entity, forKey: .entity)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct PropertyDefineTypeInput: Codable {
    let name: String
    let schema: String
}

enum PropertyDefineTypeOutput: Codable {
    case ok(name: String)
    case exists(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case name
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                name: try container.decode(String.self, forKey: .name)
            )
        case "exists":
            self = .exists(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let name):
            try container.encode("ok", forKey: .variant)
            try container.encode(name, forKey: .name)
        case .exists(let message):
            try container.encode("exists", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct PropertyListAllInput: Codable {
    let entity: String
}

enum PropertyListAllOutput: Codable {
    case ok(properties: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case properties
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                properties: try container.decode(String.self, forKey: .properties)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let properties):
            try container.encode("ok", forKey: .variant)
            try container.encode(properties, forKey: .properties)
        }
    }
}

