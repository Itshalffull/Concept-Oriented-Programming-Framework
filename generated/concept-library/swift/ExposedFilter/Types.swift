// generated: ExposedFilter/Types.swift

import Foundation

struct ExposedFilterExposeInput: Codable {
    let filter: String
    let fieldName: String
    let operator: String
    let defaultValue: String
}

enum ExposedFilterExposeOutput: Codable {
    case ok(filter: String)
    case exists(filter: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case filter
        case filter
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                filter: try container.decode(String.self, forKey: .filter)
            )
        case "exists":
            self = .exists(
                filter: try container.decode(String.self, forKey: .filter)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let filter):
            try container.encode("ok", forKey: .variant)
            try container.encode(filter, forKey: .filter)
        case .exists(let filter):
            try container.encode("exists", forKey: .variant)
            try container.encode(filter, forKey: .filter)
        }
    }
}

struct ExposedFilterCollectInputInput: Codable {
    let filter: String
    let value: String
}

enum ExposedFilterCollectInputOutput: Codable {
    case ok(filter: String)
    case notfound(filter: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case filter
        case filter
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                filter: try container.decode(String.self, forKey: .filter)
            )
        case "notfound":
            self = .notfound(
                filter: try container.decode(String.self, forKey: .filter)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let filter):
            try container.encode("ok", forKey: .variant)
            try container.encode(filter, forKey: .filter)
        case .notfound(let filter):
            try container.encode("notfound", forKey: .variant)
            try container.encode(filter, forKey: .filter)
        }
    }
}

struct ExposedFilterApplyToQueryInput: Codable {
    let filter: String
}

enum ExposedFilterApplyToQueryOutput: Codable {
    case ok(queryMod: String)
    case notfound(filter: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case queryMod
        case filter
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                queryMod: try container.decode(String.self, forKey: .queryMod)
            )
        case "notfound":
            self = .notfound(
                filter: try container.decode(String.self, forKey: .filter)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let queryMod):
            try container.encode("ok", forKey: .variant)
            try container.encode(queryMod, forKey: .queryMod)
        case .notfound(let filter):
            try container.encode("notfound", forKey: .variant)
            try container.encode(filter, forKey: .filter)
        }
    }
}

struct ExposedFilterResetToDefaultsInput: Codable {
    let filter: String
}

enum ExposedFilterResetToDefaultsOutput: Codable {
    case ok(filter: String)
    case notfound(filter: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case filter
        case filter
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                filter: try container.decode(String.self, forKey: .filter)
            )
        case "notfound":
            self = .notfound(
                filter: try container.decode(String.self, forKey: .filter)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let filter):
            try container.encode("ok", forKey: .variant)
            try container.encode(filter, forKey: .filter)
        case .notfound(let filter):
            try container.encode("notfound", forKey: .variant)
            try container.encode(filter, forKey: .filter)
        }
    }
}

