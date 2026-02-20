// generated: SyncEngine/Types.swift

import Foundation

struct SyncEngineRegisterSyncInput: Codable {
    let sync: Any
}

enum SyncEngineRegisterSyncOutput: Codable {
    case ok

    enum CodingKeys: String, CodingKey {
        case variant
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok": self = .ok
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok:
            try container.encode("ok", forKey: .variant)
        }
    }
}

struct SyncEngineOnCompletionInput: Codable {
    let completion: Any
}

enum SyncEngineOnCompletionOutput: Codable {
    case ok(invocations: [Any])

    enum CodingKeys: String, CodingKey {
        case variant
        case invocations
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                invocations: try container.decode([Any].self, forKey: .invocations)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let invocations):
            try container.encode("ok", forKey: .variant)
            try container.encode(invocations, forKey: .invocations)
        }
    }
}

struct SyncEngineEvaluateWhereInput: Codable {
    let bindings: Any
    let queries: [Any]
}

enum SyncEngineEvaluateWhereOutput: Codable {
    case ok(results: [Any])
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
                results: try container.decode([Any].self, forKey: .results)
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

struct SyncEngineQueueSyncInput: Codable {
    let sync: Any
    let bindings: Any
    let flow: String
}

enum SyncEngineQueueSyncOutput: Codable {
    case ok(pendingId: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case pendingId
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                pendingId: try container.decode(String.self, forKey: .pendingId)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let pendingId):
            try container.encode("ok", forKey: .variant)
            try container.encode(pendingId, forKey: .pendingId)
        }
    }
}

struct SyncEngineOnAvailabilityChangeInput: Codable {
    let conceptUri: String
    let available: Bool
}

enum SyncEngineOnAvailabilityChangeOutput: Codable {
    case ok(drained: [Any])

    enum CodingKeys: String, CodingKey {
        case variant
        case drained
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                drained: try container.decode([Any].self, forKey: .drained)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let drained):
            try container.encode("ok", forKey: .variant)
            try container.encode(drained, forKey: .drained)
        }
    }
}

struct SyncEngineDrainConflictsInput: Codable {
}

enum SyncEngineDrainConflictsOutput: Codable {
    case ok(conflicts: [Any])

    enum CodingKeys: String, CodingKey {
        case variant
        case conflicts
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                conflicts: try container.decode([Any].self, forKey: .conflicts)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let conflicts):
            try container.encode("ok", forKey: .variant)
            try container.encode(conflicts, forKey: .conflicts)
        }
    }
}

