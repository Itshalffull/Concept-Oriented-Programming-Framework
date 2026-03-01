// generated: ProcessEvent/Types.swift

import Foundation

struct ProcessEventAppendInput: Codable {
    let processId: String
    let eventType: String
    let payload: String
}

enum ProcessEventAppendOutput: Codable {
    case ok(eventId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case eventId
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                eventId: try container.decode(String.self, forKey: .eventId)
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
        case .ok(let eventId):
            try container.encode("ok", forKey: .variant)
            try container.encode(eventId, forKey: .eventId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ProcessEventQueryInput: Codable {
    let processId: String
}

enum ProcessEventQueryOutput: Codable {
    case ok(events: [String])
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case events
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                events: try container.decode([String].self, forKey: .events)
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
        case .ok(let events):
            try container.encode("ok", forKey: .variant)
            try container.encode(events, forKey: .events)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ProcessEventQueryByTypeInput: Codable {
    let processId: String
    let eventType: String
}

enum ProcessEventQueryByTypeOutput: Codable {
    case ok(events: [String])
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case events
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                events: try container.decode([String].self, forKey: .events)
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
        case .ok(let events):
            try container.encode("ok", forKey: .variant)
            try container.encode(events, forKey: .events)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ProcessEventGetCursorInput: Codable {
    let processId: String
}

enum ProcessEventGetCursorOutput: Codable {
    case ok(cursor: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case cursor
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                cursor: try container.decode(String.self, forKey: .cursor)
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
        case .ok(let cursor):
            try container.encode("ok", forKey: .variant)
            try container.encode(cursor, forKey: .cursor)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}
