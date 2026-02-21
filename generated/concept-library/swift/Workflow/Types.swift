// generated: Workflow/Types.swift

import Foundation

struct WorkflowDefineStateInput: Codable {
    let workflow: String
    let name: String
    let flags: String
}

enum WorkflowDefineStateOutput: Codable {
    case ok
    case exists(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok": self = .ok
        case "exists":
            self = .exists(
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
        case .exists(let message):
            try container.encode("exists", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct WorkflowDefineTransitionInput: Codable {
    let workflow: String
    let from: String
    let to: String
    let label: String
    let guard: String
}

enum WorkflowDefineTransitionOutput: Codable {
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

struct WorkflowTransitionInput: Codable {
    let workflow: String
    let entity: String
    let transition: String
}

enum WorkflowTransitionOutput: Codable {
    case ok(newState: String)
    case notfound(message: String)
    case forbidden(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case newState
        case message
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                newState: try container.decode(String.self, forKey: .newState)
            )
        case "notfound":
            self = .notfound(
                message: try container.decode(String.self, forKey: .message)
            )
        case "forbidden":
            self = .forbidden(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let newState):
            try container.encode("ok", forKey: .variant)
            try container.encode(newState, forKey: .newState)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        case .forbidden(let message):
            try container.encode("forbidden", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct WorkflowGetCurrentStateInput: Codable {
    let workflow: String
    let entity: String
}

enum WorkflowGetCurrentStateOutput: Codable {
    case ok(state: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case state
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                state: try container.decode(String.self, forKey: .state)
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
        case .ok(let state):
            try container.encode("ok", forKey: .variant)
            try container.encode(state, forKey: .state)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

