// generated: SearchIndex/Types.swift

import Foundation

struct SearchIndexCreateIndexInput: Codable {
    let index: String
    let config: String
}

enum SearchIndexCreateIndexOutput: Codable {
    case ok(index: String)
    case exists(index: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case index
        case index
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                index: try container.decode(String.self, forKey: .index)
            )
        case "exists":
            self = .exists(
                index: try container.decode(String.self, forKey: .index)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let index):
            try container.encode("ok", forKey: .variant)
            try container.encode(index, forKey: .index)
        case .exists(let index):
            try container.encode("exists", forKey: .variant)
            try container.encode(index, forKey: .index)
        }
    }
}

struct SearchIndexIndexItemInput: Codable {
    let index: String
    let item: String
    let data: String
}

enum SearchIndexIndexItemOutput: Codable {
    case ok(index: String)
    case notfound(index: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case index
        case index
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                index: try container.decode(String.self, forKey: .index)
            )
        case "notfound":
            self = .notfound(
                index: try container.decode(String.self, forKey: .index)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let index):
            try container.encode("ok", forKey: .variant)
            try container.encode(index, forKey: .index)
        case .notfound(let index):
            try container.encode("notfound", forKey: .variant)
            try container.encode(index, forKey: .index)
        }
    }
}

struct SearchIndexRemoveItemInput: Codable {
    let index: String
    let item: String
}

enum SearchIndexRemoveItemOutput: Codable {
    case ok(index: String)
    case notfound(index: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case index
        case index
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                index: try container.decode(String.self, forKey: .index)
            )
        case "notfound":
            self = .notfound(
                index: try container.decode(String.self, forKey: .index)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let index):
            try container.encode("ok", forKey: .variant)
            try container.encode(index, forKey: .index)
        case .notfound(let index):
            try container.encode("notfound", forKey: .variant)
            try container.encode(index, forKey: .index)
        }
    }
}

struct SearchIndexSearchInput: Codable {
    let index: String
    let query: String
}

enum SearchIndexSearchOutput: Codable {
    case ok(results: String)
    case notfound(index: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case results
        case index
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                results: try container.decode(String.self, forKey: .results)
            )
        case "notfound":
            self = .notfound(
                index: try container.decode(String.self, forKey: .index)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let results):
            try container.encode("ok", forKey: .variant)
            try container.encode(results, forKey: .results)
        case .notfound(let index):
            try container.encode("notfound", forKey: .variant)
            try container.encode(index, forKey: .index)
        }
    }
}

struct SearchIndexAddProcessorInput: Codable {
    let index: String
    let processor: String
}

enum SearchIndexAddProcessorOutput: Codable {
    case ok(index: String)
    case notfound(index: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case index
        case index
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                index: try container.decode(String.self, forKey: .index)
            )
        case "notfound":
            self = .notfound(
                index: try container.decode(String.self, forKey: .index)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let index):
            try container.encode("ok", forKey: .variant)
            try container.encode(index, forKey: .index)
        case .notfound(let index):
            try container.encode("notfound", forKey: .variant)
            try container.encode(index, forKey: .index)
        }
    }
}

struct SearchIndexReindexInput: Codable {
    let index: String
}

enum SearchIndexReindexOutput: Codable {
    case ok(count: Int)
    case notfound(index: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case count
        case index
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                count: try container.decode(Int.self, forKey: .count)
            )
        case "notfound":
            self = .notfound(
                index: try container.decode(String.self, forKey: .index)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let count):
            try container.encode("ok", forKey: .variant)
            try container.encode(count, forKey: .count)
        case .notfound(let index):
            try container.encode("notfound", forKey: .variant)
            try container.encode(index, forKey: .index)
        }
    }
}

