// generated: TypeSystem/Types.swift

import Foundation

struct TypeSystemRegisterTypeInput: Codable {
    let type: String
    let schema: String
    let constraints: String
}

enum TypeSystemRegisterTypeOutput: Codable {
    case ok(type: String)
    case exists(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case type
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                type: try container.decode(String.self, forKey: .type)
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
        case .ok(let type):
            try container.encode("ok", forKey: .variant)
            try container.encode(type, forKey: .type)
        case .exists(let message):
            try container.encode("exists", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct TypeSystemResolveInput: Codable {
    let type: String
}

enum TypeSystemResolveOutput: Codable {
    case ok(type: String, schema: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case type
        case schema
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                type: try container.decode(String.self, forKey: .type),
                schema: try container.decode(String.self, forKey: .schema)
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
        case .ok(let type, let schema):
            try container.encode("ok", forKey: .variant)
            try container.encode(type, forKey: .type)
            try container.encode(schema, forKey: .schema)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct TypeSystemValidateInput: Codable {
    let type: String
    let value: String
}

enum TypeSystemValidateOutput: Codable {
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

struct TypeSystemNavigateInput: Codable {
    let type: String
    let path: String
}

enum TypeSystemNavigateOutput: Codable {
    case ok(type: String, schema: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case type
        case schema
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                type: try container.decode(String.self, forKey: .type),
                schema: try container.decode(String.self, forKey: .schema)
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
        case .ok(let type, let schema):
            try container.encode("ok", forKey: .variant)
            try container.encode(type, forKey: .type)
            try container.encode(schema, forKey: .schema)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct TypeSystemSerializeInput: Codable {
    let type: String
    let value: String
}

enum TypeSystemSerializeOutput: Codable {
    case ok(serialized: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case serialized
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                serialized: try container.decode(String.self, forKey: .serialized)
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
        case .ok(let serialized):
            try container.encode("ok", forKey: .variant)
            try container.encode(serialized, forKey: .serialized)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

