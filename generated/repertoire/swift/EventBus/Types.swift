// generated: EventBus/Types.swift

import Foundation

struct EventBusRegisterEventTypeInput: Codable {
    let name: String
    let schema: String
}

enum EventBusRegisterEventTypeOutput: Codable {
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

struct EventBusSubscribeInput: Codable {
    let event: String
    let handler: String
    let priority: Int
}

enum EventBusSubscribeOutput: Codable {
    case ok(subscriptionId: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case subscriptionId
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                subscriptionId: try container.decode(String.self, forKey: .subscriptionId)
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
        }
    }
}

struct EventBusUnsubscribeInput: Codable {
    let subscriptionId: String
}

enum EventBusUnsubscribeOutput: Codable {
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

struct EventBusDispatchInput: Codable {
    let event: String
    let data: String
}

enum EventBusDispatchOutput: Codable {
    case ok(results: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case results
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                results: try container.decode(String.self, forKey: .results)
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
        case .ok(let results):
            try container.encode("ok", forKey: .variant)
            try container.encode(results, forKey: .results)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct EventBusDispatchAsyncInput: Codable {
    let event: String
    let data: String
}

enum EventBusDispatchAsyncOutput: Codable {
    case ok(jobId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case jobId
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                jobId: try container.decode(String.self, forKey: .jobId)
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
        case .ok(let jobId):
            try container.encode("ok", forKey: .variant)
            try container.encode(jobId, forKey: .jobId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct EventBusGetHistoryInput: Codable {
    let event: String
    let limit: Int
}

enum EventBusGetHistoryOutput: Codable {
    case ok(entries: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case entries
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                entries: try container.decode(String.self, forKey: .entries)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let entries):
            try container.encode("ok", forKey: .variant)
            try container.encode(entries, forKey: .entries)
        }
    }
}

