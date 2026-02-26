// generated: ContentStorage/Types.swift

import Foundation

struct ContentStorageSaveInput: Codable {
    let record: String
    let data: String
}

enum ContentStorageSaveOutput: Codable {
    case ok(record: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case record
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                record: try container.decode(String.self, forKey: .record)
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
        case .ok(let record):
            try container.encode("ok", forKey: .variant)
            try container.encode(record, forKey: .record)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ContentStorageLoadInput: Codable {
    let record: String
}

enum ContentStorageLoadOutput: Codable {
    case ok(record: String, data: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case record
        case data
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                record: try container.decode(String.self, forKey: .record),
                data: try container.decode(String.self, forKey: .data)
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
        case .ok(let record, let data):
            try container.encode("ok", forKey: .variant)
            try container.encode(record, forKey: .record)
            try container.encode(data, forKey: .data)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ContentStorageDeleteInput: Codable {
    let record: String
}

enum ContentStorageDeleteOutput: Codable {
    case ok(record: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case record
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                record: try container.decode(String.self, forKey: .record)
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
        case .ok(let record):
            try container.encode("ok", forKey: .variant)
            try container.encode(record, forKey: .record)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ContentStorageQueryInput: Codable {
    let filter: String
}

enum ContentStorageQueryOutput: Codable {
    case ok(results: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case results
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                results: try container.decode(String.self, forKey: .results)
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
        }
    }
}

struct ContentStorageGenerateSchemaInput: Codable {
    let record: String
}

enum ContentStorageGenerateSchemaOutput: Codable {
    case ok(schema: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case schema
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                schema: try container.decode(String.self, forKey: .schema)
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
        case .ok(let schema):
            try container.encode("ok", forKey: .variant)
            try container.encode(schema, forKey: .schema)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

