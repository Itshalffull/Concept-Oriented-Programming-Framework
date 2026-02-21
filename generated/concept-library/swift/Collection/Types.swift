// generated: Collection/Types.swift

import Foundation

struct CollectionCreateInput: Codable {
    let collection: String
    let type: String
    let schema: String
}

enum CollectionCreateOutput: Codable {
    case ok
    case exists

    enum CodingKeys: String, CodingKey {
        case variant
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok": self = .ok
        case "exists": self = .exists
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .exists:
            try container.encode("exists", forKey: .variant)
        }
    }
}

struct CollectionAddMemberInput: Codable {
    let collection: String
    let member: String
}

enum CollectionAddMemberOutput: Codable {
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

struct CollectionRemoveMemberInput: Codable {
    let collection: String
    let member: String
}

enum CollectionRemoveMemberOutput: Codable {
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

struct CollectionGetMembersInput: Codable {
    let collection: String
}

enum CollectionGetMembersOutput: Codable {
    case ok(members: String)
    case notfound

    enum CodingKeys: String, CodingKey {
        case variant
        case members
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                members: try container.decode(String.self, forKey: .members)
            )
        case "notfound": self = .notfound
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let members):
            try container.encode("ok", forKey: .variant)
            try container.encode(members, forKey: .members)
        case .notfound:
            try container.encode("notfound", forKey: .variant)
        }
    }
}

struct CollectionSetSchemaInput: Codable {
    let collection: String
    let schema: String
}

enum CollectionSetSchemaOutput: Codable {
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

struct CollectionCreateVirtualInput: Codable {
    let collection: String
    let query: String
}

enum CollectionCreateVirtualOutput: Codable {
    case ok
    case exists

    enum CodingKeys: String, CodingKey {
        case variant
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok": self = .ok
        case "exists": self = .exists
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .exists:
            try container.encode("exists", forKey: .variant)
        }
    }
}

struct CollectionMaterializeInput: Codable {
    let collection: String
}

enum CollectionMaterializeOutput: Codable {
    case ok(members: String)
    case notfound

    enum CodingKeys: String, CodingKey {
        case variant
        case members
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                members: try container.decode(String.self, forKey: .members)
            )
        case "notfound": self = .notfound
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let members):
            try container.encode("ok", forKey: .variant)
            try container.encode(members, forKey: .members)
        case .notfound:
            try container.encode("notfound", forKey: .variant)
        }
    }
}

