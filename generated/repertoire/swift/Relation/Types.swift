// generated: Relation/Types.swift

import Foundation

struct RelationDefineRelationInput: Codable {
    let relation: String
    let schema: String
}

enum RelationDefineRelationOutput: Codable {
    case ok(relation: String)
    case exists(relation: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case relation
        case relation
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                relation: try container.decode(String.self, forKey: .relation)
            )
        case "exists":
            self = .exists(
                relation: try container.decode(String.self, forKey: .relation)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let relation):
            try container.encode("ok", forKey: .variant)
            try container.encode(relation, forKey: .relation)
        case .exists(let relation):
            try container.encode("exists", forKey: .variant)
            try container.encode(relation, forKey: .relation)
        }
    }
}

struct RelationLinkInput: Codable {
    let relation: String
    let source: String
    let target: String
}

enum RelationLinkOutput: Codable {
    case ok(relation: String, source: String, target: String)
    case invalid(relation: String, message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case relation
        case source
        case target
        case relation
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                relation: try container.decode(String.self, forKey: .relation),
                source: try container.decode(String.self, forKey: .source),
                target: try container.decode(String.self, forKey: .target)
            )
        case "invalid":
            self = .invalid(
                relation: try container.decode(String.self, forKey: .relation),
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let relation, let source, let target):
            try container.encode("ok", forKey: .variant)
            try container.encode(relation, forKey: .relation)
            try container.encode(source, forKey: .source)
            try container.encode(target, forKey: .target)
        case .invalid(let relation, let message):
            try container.encode("invalid", forKey: .variant)
            try container.encode(relation, forKey: .relation)
            try container.encode(message, forKey: .message)
        }
    }
}

struct RelationUnlinkInput: Codable {
    let relation: String
    let source: String
    let target: String
}

enum RelationUnlinkOutput: Codable {
    case ok(relation: String, source: String, target: String)
    case notfound(relation: String, source: String, target: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case relation
        case source
        case target
        case relation
        case source
        case target
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                relation: try container.decode(String.self, forKey: .relation),
                source: try container.decode(String.self, forKey: .source),
                target: try container.decode(String.self, forKey: .target)
            )
        case "notfound":
            self = .notfound(
                relation: try container.decode(String.self, forKey: .relation),
                source: try container.decode(String.self, forKey: .source),
                target: try container.decode(String.self, forKey: .target)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let relation, let source, let target):
            try container.encode("ok", forKey: .variant)
            try container.encode(relation, forKey: .relation)
            try container.encode(source, forKey: .source)
            try container.encode(target, forKey: .target)
        case .notfound(let relation, let source, let target):
            try container.encode("notfound", forKey: .variant)
            try container.encode(relation, forKey: .relation)
            try container.encode(source, forKey: .source)
            try container.encode(target, forKey: .target)
        }
    }
}

struct RelationGetRelatedInput: Codable {
    let relation: String
    let entity: String
}

enum RelationGetRelatedOutput: Codable {
    case ok(related: String)
    case notfound(relation: String, entity: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case related
        case relation
        case entity
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                related: try container.decode(String.self, forKey: .related)
            )
        case "notfound":
            self = .notfound(
                relation: try container.decode(String.self, forKey: .relation),
                entity: try container.decode(String.self, forKey: .entity)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let related):
            try container.encode("ok", forKey: .variant)
            try container.encode(related, forKey: .related)
        case .notfound(let relation, let entity):
            try container.encode("notfound", forKey: .variant)
            try container.encode(relation, forKey: .relation)
            try container.encode(entity, forKey: .entity)
        }
    }
}

struct RelationDefineRollupInput: Codable {
    let relation: String
    let formula: String
}

enum RelationDefineRollupOutput: Codable {
    case ok(relation: String, formula: String)
    case notfound(relation: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case relation
        case formula
        case relation
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                relation: try container.decode(String.self, forKey: .relation),
                formula: try container.decode(String.self, forKey: .formula)
            )
        case "notfound":
            self = .notfound(
                relation: try container.decode(String.self, forKey: .relation)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let relation, let formula):
            try container.encode("ok", forKey: .variant)
            try container.encode(relation, forKey: .relation)
            try container.encode(formula, forKey: .formula)
        case .notfound(let relation):
            try container.encode("notfound", forKey: .variant)
            try container.encode(relation, forKey: .relation)
        }
    }
}

struct RelationComputeRollupInput: Codable {
    let relation: String
    let entity: String
}

enum RelationComputeRollupOutput: Codable {
    case ok(value: String)
    case notfound(relation: String, entity: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case value
        case relation
        case entity
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
                relation: try container.decode(String.self, forKey: .relation),
                entity: try container.decode(String.self, forKey: .entity)
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
        case .notfound(let relation, let entity):
            try container.encode("notfound", forKey: .variant)
            try container.encode(relation, forKey: .relation)
            try container.encode(entity, forKey: .entity)
        }
    }
}

