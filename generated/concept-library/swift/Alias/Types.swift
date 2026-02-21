// generated: Alias/Types.swift

import Foundation

struct AliasAddAliasInput: Codable {
    let entity: String
    let name: String
}

enum AliasAddAliasOutput: Codable {
    case ok(entity: String, name: String)
    case exists(entity: String, name: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case entity
        case name
        case entity
        case name
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                entity: try container.decode(String.self, forKey: .entity),
                name: try container.decode(String.self, forKey: .name)
            )
        case "exists":
            self = .exists(
                entity: try container.decode(String.self, forKey: .entity),
                name: try container.decode(String.self, forKey: .name)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let entity, let name):
            try container.encode("ok", forKey: .variant)
            try container.encode(entity, forKey: .entity)
            try container.encode(name, forKey: .name)
        case .exists(let entity, let name):
            try container.encode("exists", forKey: .variant)
            try container.encode(entity, forKey: .entity)
            try container.encode(name, forKey: .name)
        }
    }
}

struct AliasRemoveAliasInput: Codable {
    let entity: String
    let name: String
}

enum AliasRemoveAliasOutput: Codable {
    case ok(entity: String, name: String)
    case notfound(entity: String, name: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case entity
        case name
        case entity
        case name
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                entity: try container.decode(String.self, forKey: .entity),
                name: try container.decode(String.self, forKey: .name)
            )
        case "notfound":
            self = .notfound(
                entity: try container.decode(String.self, forKey: .entity),
                name: try container.decode(String.self, forKey: .name)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let entity, let name):
            try container.encode("ok", forKey: .variant)
            try container.encode(entity, forKey: .entity)
            try container.encode(name, forKey: .name)
        case .notfound(let entity, let name):
            try container.encode("notfound", forKey: .variant)
            try container.encode(entity, forKey: .entity)
            try container.encode(name, forKey: .name)
        }
    }
}

struct AliasResolveInput: Codable {
    let name: String
}

enum AliasResolveOutput: Codable {
    case ok(entity: String)
    case notfound(name: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case entity
        case name
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
                name: try container.decode(String.self, forKey: .name)
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
        case .notfound(let name):
            try container.encode("notfound", forKey: .variant)
            try container.encode(name, forKey: .name)
        }
    }
}

