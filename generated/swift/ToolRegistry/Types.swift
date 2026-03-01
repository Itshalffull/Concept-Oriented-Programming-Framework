// generated: ToolRegistry/Types.swift

import Foundation

struct ToolRegistryRegisterInput: Codable {
    let name: String
    let description: String
    let schema: Data
}

enum ToolRegistryRegisterOutput: Codable {
    case ok(tool: String, version: Int)
    case invalidSchema(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case tool
        case version
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                tool: try container.decode(String.self, forKey: .tool),
                version: try container.decode(Int.self, forKey: .version)
            )
        case "invalidSchema":
            self = .invalidSchema(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let tool, let version):
            try container.encode("ok", forKey: .variant)
            try container.encode(tool, forKey: .tool)
            try container.encode(version, forKey: .version)
        case .invalidSchema(let message):
            try container.encode("invalidSchema", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ToolRegistryDeprecateInput: Codable {
    let tool: String
}

enum ToolRegistryDeprecateOutput: Codable {
    case ok(tool: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case tool
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                tool: try container.decode(String.self, forKey: .tool)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let tool):
            try container.encode("ok", forKey: .variant)
            try container.encode(tool, forKey: .tool)
        }
    }
}

struct ToolRegistryDisableInput: Codable {
    let tool: String
}

enum ToolRegistryDisableOutput: Codable {
    case ok(tool: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case tool
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                tool: try container.decode(String.self, forKey: .tool)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let tool):
            try container.encode("ok", forKey: .variant)
            try container.encode(tool, forKey: .tool)
        }
    }
}

struct ToolRegistryAuthorizeInput: Codable {
    let tool: String
    let model: String
    let processRef: String
}

enum ToolRegistryAuthorizeOutput: Codable {
    case ok(tool: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case tool
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                tool: try container.decode(String.self, forKey: .tool)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let tool):
            try container.encode("ok", forKey: .variant)
            try container.encode(tool, forKey: .tool)
        }
    }
}

struct ToolRegistryCheckAccessInput: Codable {
    let tool: String
    let model: String
    let processRef: String
}

enum ToolRegistryCheckAccessOutput: Codable {
    case allowed(tool: String, schema: Data)
    case denied(tool: String, reason: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case tool
        case schema
        case reason
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "allowed":
            self = .allowed(
                tool: try container.decode(String.self, forKey: .tool),
                schema: try container.decode(Data.self, forKey: .schema)
            )
        case "denied":
            self = .denied(
                tool: try container.decode(String.self, forKey: .tool),
                reason: try container.decode(String.self, forKey: .reason)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .allowed(let tool, let schema):
            try container.encode("allowed", forKey: .variant)
            try container.encode(tool, forKey: .tool)
            try container.encode(schema, forKey: .schema)
        case .denied(let tool, let reason):
            try container.encode("denied", forKey: .variant)
            try container.encode(tool, forKey: .tool)
            try container.encode(reason, forKey: .reason)
        }
    }
}

struct ToolRegistryListActiveInput: Codable {
    let processRef: String
}

enum ToolRegistryListActiveOutput: Codable {
    case ok(tools: Data)

    enum CodingKeys: String, CodingKey {
        case variant
        case tools
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                tools: try container.decode(Data.self, forKey: .tools)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let tools):
            try container.encode("ok", forKey: .variant)
            try container.encode(tools, forKey: .tools)
        }
    }
}
