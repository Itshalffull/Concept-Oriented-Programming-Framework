// generated: ConnectorCall/Types.swift

import Foundation

struct ConnectorCallInvokeInput: Codable {
    let stepRef: String
    let connectorType: String
    let operation: String
    let input: Data
    let idempotencyKey: String
}

enum ConnectorCallInvokeOutput: Codable {
    case ok(call: String, stepRef: String)
    case duplicate(idempotencyKey: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case call
        case stepRef
        case idempotencyKey
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                call: try container.decode(String.self, forKey: .call),
                stepRef: try container.decode(String.self, forKey: .stepRef)
            )
        case "duplicate":
            self = .duplicate(
                idempotencyKey: try container.decode(String.self, forKey: .idempotencyKey)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let call, let stepRef):
            try container.encode("ok", forKey: .variant)
            try container.encode(call, forKey: .call)
            try container.encode(stepRef, forKey: .stepRef)
        case .duplicate(let idempotencyKey):
            try container.encode("duplicate", forKey: .variant)
            try container.encode(idempotencyKey, forKey: .idempotencyKey)
        }
    }
}

struct ConnectorCallMarkSuccessInput: Codable {
    let call: String
    let output: Data
}

enum ConnectorCallMarkSuccessOutput: Codable {
    case ok(call: String, stepRef: String, output: Data)
    case notInvoking(call: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case call
        case stepRef
        case output
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                call: try container.decode(String.self, forKey: .call),
                stepRef: try container.decode(String.self, forKey: .stepRef),
                output: try container.decode(Data.self, forKey: .output)
            )
        case "notInvoking":
            self = .notInvoking(
                call: try container.decode(String.self, forKey: .call)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let call, let stepRef, let output):
            try container.encode("ok", forKey: .variant)
            try container.encode(call, forKey: .call)
            try container.encode(stepRef, forKey: .stepRef)
            try container.encode(output, forKey: .output)
        case .notInvoking(let call):
            try container.encode("notInvoking", forKey: .variant)
            try container.encode(call, forKey: .call)
        }
    }
}

struct ConnectorCallMarkFailureInput: Codable {
    let call: String
    let error: String
}

enum ConnectorCallMarkFailureOutput: Codable {
    case error(call: String, stepRef: String, message: String)
    case notInvoking(call: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case call
        case stepRef
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "error":
            self = .error(
                call: try container.decode(String.self, forKey: .call),
                stepRef: try container.decode(String.self, forKey: .stepRef),
                message: try container.decode(String.self, forKey: .message)
            )
        case "notInvoking":
            self = .notInvoking(
                call: try container.decode(String.self, forKey: .call)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .error(let call, let stepRef, let message):
            try container.encode("error", forKey: .variant)
            try container.encode(call, forKey: .call)
            try container.encode(stepRef, forKey: .stepRef)
            try container.encode(message, forKey: .message)
        case .notInvoking(let call):
            try container.encode("notInvoking", forKey: .variant)
            try container.encode(call, forKey: .call)
        }
    }
}

struct ConnectorCallGetResultInput: Codable {
    let call: String
}

enum ConnectorCallGetResultOutput: Codable {
    case ok(call: String, status: String, output: Data)
    case notFound(call: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case call
        case status
        case output
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                call: try container.decode(String.self, forKey: .call),
                status: try container.decode(String.self, forKey: .status),
                output: try container.decode(Data.self, forKey: .output)
            )
        case "notFound":
            self = .notFound(
                call: try container.decode(String.self, forKey: .call)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let call, let status, let output):
            try container.encode("ok", forKey: .variant)
            try container.encode(call, forKey: .call)
            try container.encode(status, forKey: .status)
            try container.encode(output, forKey: .output)
        case .notFound(let call):
            try container.encode("notFound", forKey: .variant)
            try container.encode(call, forKey: .call)
        }
    }
}
