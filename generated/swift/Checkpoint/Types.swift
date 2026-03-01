// generated: Checkpoint/Types.swift

import Foundation

struct CheckpointCaptureInput: Codable {
    let runRef: String
    let runState: Data
    let variablesSnapshot: Data
    let tokenSnapshot: Data
    let eventCursor: Int
}

enum CheckpointCaptureOutput: Codable {
    case ok(checkpoint: String, timestamp: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case checkpoint
        case timestamp
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                checkpoint: try container.decode(String.self, forKey: .checkpoint),
                timestamp: try container.decode(String.self, forKey: .timestamp)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let checkpoint, let timestamp):
            try container.encode("ok", forKey: .variant)
            try container.encode(checkpoint, forKey: .checkpoint)
            try container.encode(timestamp, forKey: .timestamp)
        }
    }
}

struct CheckpointRestoreInput: Codable {
    let checkpoint: String
}

enum CheckpointRestoreOutput: Codable {
    case ok(checkpoint: String, runState: Data, variablesSnapshot: Data, tokenSnapshot: Data, eventCursor: Int)
    case notFound(checkpoint: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case checkpoint
        case runState
        case variablesSnapshot
        case tokenSnapshot
        case eventCursor
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                checkpoint: try container.decode(String.self, forKey: .checkpoint),
                runState: try container.decode(Data.self, forKey: .runState),
                variablesSnapshot: try container.decode(Data.self, forKey: .variablesSnapshot),
                tokenSnapshot: try container.decode(Data.self, forKey: .tokenSnapshot),
                eventCursor: try container.decode(Int.self, forKey: .eventCursor)
            )
        case "notFound":
            self = .notFound(
                checkpoint: try container.decode(String.self, forKey: .checkpoint)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let checkpoint, let runState, let variablesSnapshot, let tokenSnapshot, let eventCursor):
            try container.encode("ok", forKey: .variant)
            try container.encode(checkpoint, forKey: .checkpoint)
            try container.encode(runState, forKey: .runState)
            try container.encode(variablesSnapshot, forKey: .variablesSnapshot)
            try container.encode(tokenSnapshot, forKey: .tokenSnapshot)
            try container.encode(eventCursor, forKey: .eventCursor)
        case .notFound(let checkpoint):
            try container.encode("notFound", forKey: .variant)
            try container.encode(checkpoint, forKey: .checkpoint)
        }
    }
}

struct CheckpointFindLatestInput: Codable {
    let runRef: String
}

enum CheckpointFindLatestOutput: Codable {
    case ok(checkpoint: String)
    case none(runRef: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case checkpoint
        case runRef
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                checkpoint: try container.decode(String.self, forKey: .checkpoint)
            )
        case "none":
            self = .none(
                runRef: try container.decode(String.self, forKey: .runRef)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let checkpoint):
            try container.encode("ok", forKey: .variant)
            try container.encode(checkpoint, forKey: .checkpoint)
        case .none(let runRef):
            try container.encode("none", forKey: .variant)
            try container.encode(runRef, forKey: .runRef)
        }
    }
}

struct CheckpointPruneInput: Codable {
    let runRef: String
    let keepCount: Int
}

enum CheckpointPruneOutput: Codable {
    case ok(pruned: Int)

    enum CodingKeys: String, CodingKey {
        case variant
        case pruned
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                pruned: try container.decode(Int.self, forKey: .pruned)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let pruned):
            try container.encode("ok", forKey: .variant)
            try container.encode(pruned, forKey: .pruned)
        }
    }
}
