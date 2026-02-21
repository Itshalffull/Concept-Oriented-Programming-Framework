// generated: Reference/Types.swift

import Foundation

struct ReferenceAddRefInput: Codable {
    let source: String
    let target: String
}

enum ReferenceAddRefOutput: Codable {
    case ok(source: String, target: String)
    case exists(source: String, target: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case source
        case target
        case source
        case target
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                source: try container.decode(String.self, forKey: .source),
                target: try container.decode(String.self, forKey: .target)
            )
        case "exists":
            self = .exists(
                source: try container.decode(String.self, forKey: .source),
                target: try container.decode(String.self, forKey: .target)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let source, let target):
            try container.encode("ok", forKey: .variant)
            try container.encode(source, forKey: .source)
            try container.encode(target, forKey: .target)
        case .exists(let source, let target):
            try container.encode("exists", forKey: .variant)
            try container.encode(source, forKey: .source)
            try container.encode(target, forKey: .target)
        }
    }
}

struct ReferenceRemoveRefInput: Codable {
    let source: String
    let target: String
}

enum ReferenceRemoveRefOutput: Codable {
    case ok(source: String, target: String)
    case notfound(source: String, target: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case source
        case target
        case source
        case target
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                source: try container.decode(String.self, forKey: .source),
                target: try container.decode(String.self, forKey: .target)
            )
        case "notfound":
            self = .notfound(
                source: try container.decode(String.self, forKey: .source),
                target: try container.decode(String.self, forKey: .target)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let source, let target):
            try container.encode("ok", forKey: .variant)
            try container.encode(source, forKey: .source)
            try container.encode(target, forKey: .target)
        case .notfound(let source, let target):
            try container.encode("notfound", forKey: .variant)
            try container.encode(source, forKey: .source)
            try container.encode(target, forKey: .target)
        }
    }
}

struct ReferenceGetRefsInput: Codable {
    let source: String
}

enum ReferenceGetRefsOutput: Codable {
    case ok(targets: String)
    case notfound(source: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case targets
        case source
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                targets: try container.decode(String.self, forKey: .targets)
            )
        case "notfound":
            self = .notfound(
                source: try container.decode(String.self, forKey: .source)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let targets):
            try container.encode("ok", forKey: .variant)
            try container.encode(targets, forKey: .targets)
        case .notfound(let source):
            try container.encode("notfound", forKey: .variant)
            try container.encode(source, forKey: .source)
        }
    }
}

struct ReferenceResolveTargetInput: Codable {
    let target: String
}

enum ReferenceResolveTargetOutput: Codable {
    case ok(exists: Bool)

    enum CodingKeys: String, CodingKey {
        case variant
        case exists
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                exists: try container.decode(Bool.self, forKey: .exists)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let exists):
            try container.encode("ok", forKey: .variant)
            try container.encode(exists, forKey: .exists)
        }
    }
}

