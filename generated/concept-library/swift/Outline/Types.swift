// generated: Outline/Types.swift

import Foundation

struct OutlineCreateInput: Codable {
    let node: String
    let parent: String?
}

enum OutlineCreateOutput: Codable {
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

struct OutlineIndentInput: Codable {
    let node: String
}

enum OutlineIndentOutput: Codable {
    case ok(node: String)
    case notfound(message: String)
    case invalid(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case node
        case message
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
        case .ok(let node):
            try container.encode("ok", forKey: .variant)
            try container.encode(node, forKey: .node)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        case .invalid(let message):
            try container.encode("invalid", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct OutlineOutdentInput: Codable {
    let node: String
}

enum OutlineOutdentOutput: Codable {
    case ok(node: String)
    case notfound(message: String)
    case invalid(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case node
        case message
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
        case .ok(let node):
            try container.encode("ok", forKey: .variant)
            try container.encode(node, forKey: .node)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        case .invalid(let message):
            try container.encode("invalid", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct OutlineMoveUpInput: Codable {
    let node: String
}

enum OutlineMoveUpOutput: Codable {
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

struct OutlineMoveDownInput: Codable {
    let node: String
}

enum OutlineMoveDownOutput: Codable {
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

struct OutlineCollapseInput: Codable {
    let node: String
}

enum OutlineCollapseOutput: Codable {
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

struct OutlineExpandInput: Codable {
    let node: String
}

enum OutlineExpandOutput: Codable {
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

struct OutlineReparentInput: Codable {
    let node: String
    let newParent: String
}

enum OutlineReparentOutput: Codable {
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

struct OutlineGetChildrenInput: Codable {
    let node: String
}

enum OutlineGetChildrenOutput: Codable {
    case ok(children: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case children
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                children: try container.decode(String.self, forKey: .children)
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
        case .ok(let children):
            try container.encode("ok", forKey: .variant)
            try container.encode(children, forKey: .children)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

