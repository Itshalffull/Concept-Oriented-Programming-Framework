// generated: ProcessRun/Types.swift

import Foundation

struct ProcessRunStartInput: Codable {
    let specId: String
    let initiator: String
}

enum ProcessRunStartOutput: Codable {
    case ok(processId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case processId
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                processId: try container.decode(String.self, forKey: .processId)
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
        case .ok(let processId):
            try container.encode("ok", forKey: .variant)
            try container.encode(processId, forKey: .processId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ProcessRunStartChildInput: Codable {
    let parentProcessId: String
    let specId: String
}

enum ProcessRunStartChildOutput: Codable {
    case ok(childProcessId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case childProcessId
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                childProcessId: try container.decode(String.self, forKey: .childProcessId)
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
        case .ok(let childProcessId):
            try container.encode("ok", forKey: .variant)
            try container.encode(childProcessId, forKey: .childProcessId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ProcessRunCompleteInput: Codable {
    let processId: String
    let result: String
}

enum ProcessRunCompleteOutput: Codable {
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

struct ProcessRunFailInput: Codable {
    let processId: String
    let reason: String
}

enum ProcessRunFailOutput: Codable {
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

struct ProcessRunCancelInput: Codable {
    let processId: String
    let reason: String
}

enum ProcessRunCancelOutput: Codable {
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

struct ProcessRunSuspendInput: Codable {
    let processId: String
    let reason: String
}

enum ProcessRunSuspendOutput: Codable {
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

struct ProcessRunResumeInput: Codable {
    let processId: String
}

enum ProcessRunResumeOutput: Codable {
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

struct ProcessRunGetStatusInput: Codable {
    let processId: String
}

enum ProcessRunGetStatusOutput: Codable {
    case ok(processId: String, status: String, specId: String)
    case notFound
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case processId
        case status
        case specId
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                processId: try container.decode(String.self, forKey: .processId),
                status: try container.decode(String.self, forKey: .status),
                specId: try container.decode(String.self, forKey: .specId)
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
        case .ok(let processId, let status, let specId):
            try container.encode("ok", forKey: .variant)
            try container.encode(processId, forKey: .processId)
            try container.encode(status, forKey: .status)
            try container.encode(specId, forKey: .specId)
        case .notFound:
            try container.encode("notFound", forKey: .variant)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}
