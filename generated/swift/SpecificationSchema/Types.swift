// generated: SpecificationSchema/Types.swift

import Foundation

struct SpecificationSchemaDefineInput: Codable {
    let name: String
    let category: String
    let pattern_type: String
    let template_text: String
    let formal_language: String
    let parameters: Data
}

enum SpecificationSchemaDefineOutput: Codable {
    case ok(schema: String)
    case invalid(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case schema
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                schema: try container.decode(String.self, forKey: .schema)
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
        case .ok(let schema):
            try container.encode("ok", forKey: .variant)
            try container.encode(schema, forKey: .schema)
        case .invalid(let message):
            try container.encode("invalid", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct SpecificationSchemaInstantiateInput: Codable {
    let schema: String
    let parameter_values: Data
    let target_symbol: String
}

enum SpecificationSchemaInstantiateOutput: Codable {
    case ok(property_ref: String)
    case invalid(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case property_ref
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                property_ref: try container.decode(String.self, forKey: .property_ref)
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
        case .ok(let property_ref):
            try container.encode("ok", forKey: .variant)
            try container.encode(property_ref, forKey: .property_ref)
        case .invalid(let message):
            try container.encode("invalid", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct SpecificationSchemaValidateInput: Codable {
    let schema: String
    let parameter_values: Data
}

enum SpecificationSchemaValidateOutput: Codable {
    case ok(valid: Bool, instantiated_preview: String)
    case invalid(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case valid
        case instantiated_preview
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                valid: try container.decode(Bool.self, forKey: .valid),
                instantiated_preview: try container.decode(String.self, forKey: .instantiated_preview)
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
        case .ok(let valid, let instantiated_preview):
            try container.encode("ok", forKey: .variant)
            try container.encode(valid, forKey: .valid)
            try container.encode(instantiated_preview, forKey: .instantiated_preview)
        case .invalid(let message):
            try container.encode("invalid", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct SpecificationSchemaList_by_categoryInput: Codable {
    let category: String
}

enum SpecificationSchemaList_by_categoryOutput: Codable {
    case ok(schemas: [String])

    enum CodingKeys: String, CodingKey {
        case variant
        case schemas
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                schemas: try container.decode([String].self, forKey: .schemas)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let schemas):
            try container.encode("ok", forKey: .variant)
            try container.encode(schemas, forKey: .schemas)
        }
    }
}

struct SpecificationSchemaSearchInput: Codable {
    let query: String
}

enum SpecificationSchemaSearchOutput: Codable {
    case ok(schemas: [String])

    enum CodingKeys: String, CodingKey {
        case variant
        case schemas
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                schemas: try container.decode([String].self, forKey: .schemas)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let schemas):
            try container.encode("ok", forKey: .variant)
            try container.encode(schemas, forKey: .schemas)
        }
    }
}
