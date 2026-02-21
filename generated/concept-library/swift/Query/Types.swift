// generated: Query/Types.swift

import Foundation

struct QueryParseInput: Codable {
    let query: String
    let expression: String
}

enum QueryParseOutput: Codable {
    case ok(query: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case query
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                query: try container.decode(String.self, forKey: .query)
            )
        case "error":
            self = .error(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let query):
            try container.encode("ok", forKey: .variant)
            try container.encode(query, forKey: .query)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct QueryExecuteInput: Codable {
    let query: String
}

enum QueryExecuteOutput: Codable {
    case ok(results: String)
    case notfound(query: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case results
        case query
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
                query: try container.decode(String.self, forKey: .query)
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
        case .notfound(let query):
            try container.encode("notfound", forKey: .variant)
            try container.encode(query, forKey: .query)
        }
    }
}

struct QuerySubscribeInput: Codable {
    let query: String
}

enum QuerySubscribeOutput: Codable {
    case ok(subscriptionId: String)
    case notfound(query: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case subscriptionId
        case query
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                subscriptionId: try container.decode(String.self, forKey: .subscriptionId)
            )
        case "notfound":
            self = .notfound(
                query: try container.decode(String.self, forKey: .query)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let subscriptionId):
            try container.encode("ok", forKey: .variant)
            try container.encode(subscriptionId, forKey: .subscriptionId)
        case .notfound(let query):
            try container.encode("notfound", forKey: .variant)
            try container.encode(query, forKey: .query)
        }
    }
}

struct QueryAddFilterInput: Codable {
    let query: String
    let filter: String
}

enum QueryAddFilterOutput: Codable {
    case ok(query: String)
    case notfound(query: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case query
        case query
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                query: try container.decode(String.self, forKey: .query)
            )
        case "notfound":
            self = .notfound(
                query: try container.decode(String.self, forKey: .query)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let query):
            try container.encode("ok", forKey: .variant)
            try container.encode(query, forKey: .query)
        case .notfound(let query):
            try container.encode("notfound", forKey: .variant)
            try container.encode(query, forKey: .query)
        }
    }
}

struct QueryAddSortInput: Codable {
    let query: String
    let sort: String
}

enum QueryAddSortOutput: Codable {
    case ok(query: String)
    case notfound(query: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case query
        case query
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                query: try container.decode(String.self, forKey: .query)
            )
        case "notfound":
            self = .notfound(
                query: try container.decode(String.self, forKey: .query)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let query):
            try container.encode("ok", forKey: .variant)
            try container.encode(query, forKey: .query)
        case .notfound(let query):
            try container.encode("notfound", forKey: .variant)
            try container.encode(query, forKey: .query)
        }
    }
}

struct QuerySetScopeInput: Codable {
    let query: String
    let scope: String
}

enum QuerySetScopeOutput: Codable {
    case ok(query: String)
    case notfound(query: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case query
        case query
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                query: try container.decode(String.self, forKey: .query)
            )
        case "notfound":
            self = .notfound(
                query: try container.decode(String.self, forKey: .query)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let query):
            try container.encode("ok", forKey: .variant)
            try container.encode(query, forKey: .query)
        case .notfound(let query):
            try container.encode("notfound", forKey: .variant)
            try container.encode(query, forKey: .query)
        }
    }
}

