// generated: Graph/Types.swift

import Foundation

struct GraphAddNodeInput: Codable {
    let graph: String
    let node: String
}

enum GraphAddNodeOutput: Codable {
    case ok
    case notfound

    enum CodingKeys: String, CodingKey {
        case variant
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok": self = .ok
        case "notfound": self = .notfound
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .notfound:
            try container.encode("notfound", forKey: .variant)
        }
    }
}

struct GraphRemoveNodeInput: Codable {
    let graph: String
    let node: String
}

enum GraphRemoveNodeOutput: Codable {
    case ok
    case notfound

    enum CodingKeys: String, CodingKey {
        case variant
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok": self = .ok
        case "notfound": self = .notfound
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .notfound:
            try container.encode("notfound", forKey: .variant)
        }
    }
}

struct GraphAddEdgeInput: Codable {
    let graph: String
    let source: String
    let target: String
}

enum GraphAddEdgeOutput: Codable {
    case ok
    case notfound

    enum CodingKeys: String, CodingKey {
        case variant
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok": self = .ok
        case "notfound": self = .notfound
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .notfound:
            try container.encode("notfound", forKey: .variant)
        }
    }
}

struct GraphRemoveEdgeInput: Codable {
    let graph: String
    let source: String
    let target: String
}

enum GraphRemoveEdgeOutput: Codable {
    case ok
    case notfound

    enum CodingKeys: String, CodingKey {
        case variant
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok": self = .ok
        case "notfound": self = .notfound
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .notfound:
            try container.encode("notfound", forKey: .variant)
        }
    }
}

struct GraphComputeLayoutInput: Codable {
    let graph: String
}

enum GraphComputeLayoutOutput: Codable {
    case ok(layout: String)
    case notfound

    enum CodingKeys: String, CodingKey {
        case variant
        case layout
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                layout: try container.decode(String.self, forKey: .layout)
            )
        case "notfound": self = .notfound
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let layout):
            try container.encode("ok", forKey: .variant)
            try container.encode(layout, forKey: .layout)
        case .notfound:
            try container.encode("notfound", forKey: .variant)
        }
    }
}

struct GraphGetNeighborsInput: Codable {
    let graph: String
    let node: String
    let depth: Int
}

enum GraphGetNeighborsOutput: Codable {
    case ok(neighbors: String)
    case notfound

    enum CodingKeys: String, CodingKey {
        case variant
        case neighbors
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                neighbors: try container.decode(String.self, forKey: .neighbors)
            )
        case "notfound": self = .notfound
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let neighbors):
            try container.encode("ok", forKey: .variant)
            try container.encode(neighbors, forKey: .neighbors)
        case .notfound:
            try container.encode("notfound", forKey: .variant)
        }
    }
}

struct GraphFilterNodesInput: Codable {
    let graph: String
    let filter: String
}

enum GraphFilterNodesOutput: Codable {
    case ok(filtered: String)
    case notfound

    enum CodingKeys: String, CodingKey {
        case variant
        case filtered
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                filtered: try container.decode(String.self, forKey: .filtered)
            )
        case "notfound": self = .notfound
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let filtered):
            try container.encode("ok", forKey: .variant)
            try container.encode(filtered, forKey: .filtered)
        case .notfound:
            try container.encode("notfound", forKey: .variant)
        }
    }
}

