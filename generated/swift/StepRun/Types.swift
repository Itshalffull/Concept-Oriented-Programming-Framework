// generated: StepRun/Types.swift

import Foundation

struct StepRunStartInput: Codable {
    let processId: String
    let stepId: String
    let stepName: String
}

enum StepRunStartOutput: Codable {
    case ok(runId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case runId
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                runId: try container.decode(String.self, forKey: .runId)
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
        case .ok(let runId):
            try container.encode("ok", forKey: .variant)
            try container.encode(runId, forKey: .runId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct StepRunCompleteInput: Codable {
    let runId: String
    let output: String
}

enum StepRunCompleteOutput: Codable {
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

struct StepRunFailInput: Codable {
    let runId: String
    let reason: String
}

enum StepRunFailOutput: Codable {
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

struct StepRunCancelInput: Codable {
    let runId: String
    let reason: String
}

enum StepRunCancelOutput: Codable {
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

struct StepRunSkipInput: Codable {
    let runId: String
    let reason: String
}

enum StepRunSkipOutput: Codable {
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

struct StepRunGetInput: Codable {
    let runId: String
}

enum StepRunGetOutput: Codable {
    case ok(runId: String, stepId: String, stepName: String, status: String)
    case notFound
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case runId
        case stepId
        case stepName
        case status
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                runId: try container.decode(String.self, forKey: .runId),
                stepId: try container.decode(String.self, forKey: .stepId),
                stepName: try container.decode(String.self, forKey: .stepName),
                status: try container.decode(String.self, forKey: .status)
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
        case .ok(let runId, let stepId, let stepName, let status):
            try container.encode("ok", forKey: .variant)
            try container.encode(runId, forKey: .runId)
            try container.encode(stepId, forKey: .stepId)
            try container.encode(stepName, forKey: .stepName)
            try container.encode(status, forKey: .status)
        case .notFound:
            try container.encode("notFound", forKey: .variant)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}
