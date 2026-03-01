// generated: ProcessVariable/Types.swift

import Foundation

struct ProcessVariableSetInput: Codable {
    let processId: String
    let key: String
    let value: String
}

enum ProcessVariableSetOutput: Codable {
    case ok
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok": self = .ok
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
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ProcessVariableGetInput: Codable {
    let processId: String
    let key: String
}

enum ProcessVariableGetOutput: Codable {
    case ok(value: String)
    case notFound
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case value
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                value: try container.decode(String.self, forKey: .value)
            )
        case "notFound": self = .notFound
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
        case .ok(let value):
            try container.encode("ok", forKey: .variant)
            try container.encode(value, forKey: .value)
        case .notFound:
            try container.encode("notFound", forKey: .variant)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ProcessVariableMergeInput: Codable {
    let processId: String
    let variables: String
}

enum ProcessVariableMergeOutput: Codable {
    case ok(merged: Int)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case merged
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                merged: try container.decode(Int.self, forKey: .merged)
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
        case .ok(let merged):
            try container.encode("ok", forKey: .variant)
            try container.encode(merged, forKey: .merged)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ProcessVariableDeleteInput: Codable {
    let processId: String
    let key: String
}

enum ProcessVariableDeleteOutput: Codable {
    case ok
    case notFound
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok": self = .ok
        case "notFound": self = .notFound
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
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .notFound:
            try container.encode("notFound", forKey: .variant)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ProcessVariableListInput: Codable {
    let processId: String
}

enum ProcessVariableListOutput: Codable {
    case ok(keys: [String])
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case keys
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                keys: try container.decode([String].self, forKey: .keys)
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
        case .ok(let keys):
            try container.encode("ok", forKey: .variant)
            try container.encode(keys, forKey: .keys)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ProcessVariableSnapshotInput: Codable {
    let processId: String
}

enum ProcessVariableSnapshotOutput: Codable {
    case ok(snapshot: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case snapshot
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                snapshot: try container.decode(String.self, forKey: .snapshot)
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
        case .ok(let snapshot):
            try container.encode("ok", forKey: .variant)
            try container.encode(snapshot, forKey: .snapshot)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}
