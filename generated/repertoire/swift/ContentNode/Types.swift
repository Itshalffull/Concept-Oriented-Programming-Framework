// generated: ContentNode/Types.swift

import Foundation

struct ContentNodeCreateInput: Codable {
    let node: String
    let type: String
    let content: String
    let createdBy: String
}

enum ContentNodeCreateOutput: Codable {
    case ok(node: String)
    case exists(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case node
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                node: try container.decode(String.self, forKey: .node)
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
        case .ok(let node):
            try container.encode("ok", forKey: .variant)
            try container.encode(node, forKey: .node)
        case .exists(let message):
            try container.encode("exists", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ContentNodeUpdateInput: Codable {
    let node: String
    let content: String
}

enum ContentNodeUpdateOutput: Codable {
    case ok(node: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case node
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                node: try container.decode(String.self, forKey: .node)
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
        case .ok(let node):
            try container.encode("ok", forKey: .variant)
            try container.encode(node, forKey: .node)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ContentNodeDeleteInput: Codable {
    let node: String
}

enum ContentNodeDeleteOutput: Codable {
    case ok(node: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case node
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                node: try container.decode(String.self, forKey: .node)
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
        case .ok(let node):
            try container.encode("ok", forKey: .variant)
            try container.encode(node, forKey: .node)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ContentNodeGetInput: Codable {
    let node: String
}

enum ContentNodeGetOutput: Codable {
    case ok(node: String, type: String, content: String, metadata: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case node
        case type
        case content
        case metadata
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                node: try container.decode(String.self, forKey: .node),
                type: try container.decode(String.self, forKey: .type),
                content: try container.decode(String.self, forKey: .content),
                metadata: try container.decode(String.self, forKey: .metadata)
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
        case .ok(let node, let type, let content, let metadata):
            try container.encode("ok", forKey: .variant)
            try container.encode(node, forKey: .node)
            try container.encode(type, forKey: .type)
            try container.encode(content, forKey: .content)
            try container.encode(metadata, forKey: .metadata)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ContentNodeSetMetadataInput: Codable {
    let node: String
    let metadata: String
}

enum ContentNodeSetMetadataOutput: Codable {
    case ok(node: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case node
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                node: try container.decode(String.self, forKey: .node)
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
        case .ok(let node):
            try container.encode("ok", forKey: .variant)
            try container.encode(node, forKey: .node)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ContentNodeChangeTypeInput: Codable {
    let node: String
    let type: String
}

enum ContentNodeChangeTypeOutput: Codable {
    case ok(node: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case node
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                node: try container.decode(String.self, forKey: .node)
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
        case .ok(let node):
            try container.encode("ok", forKey: .variant)
            try container.encode(node, forKey: .node)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

