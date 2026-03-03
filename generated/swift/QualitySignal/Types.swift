// generated: QualitySignal/Types.swift

import Foundation

struct QualitySignalRecordInput: Codable {
    let target_symbol: String
    let dimension: String
    let status: String
    let severity: String
    let summary: String?
    let artifact_path: String?
    let artifact_hash: String?
    let run_ref: String?
}

enum QualitySignalRecordOutput: Codable {
    case ok(signal: String)
    case invalid(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case signal
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                signal: try container.decode(String.self, forKey: .signal)
            )
        case "invalid":
            self = .invalid(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let signal):
            try container.encode("ok", forKey: .variant)
            try container.encode(signal, forKey: .signal)
        case .invalid(let message):
            try container.encode("invalid", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct QualitySignalLatestInput: Codable {
    let target_symbol: String
    let dimension: String
}

enum QualitySignalLatestOutput: Codable {
    case ok(signal: String, status: String, severity: String, summary: String?, observed_at: Date)
    case notfound(target_symbol: String, dimension: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case signal
        case status
        case severity
        case summary
        case observed_at
        case target_symbol
        case dimension
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                signal: try container.decode(String.self, forKey: .signal),
                status: try container.decode(String.self, forKey: .status),
                severity: try container.decode(String.self, forKey: .severity),
                summary: try container.decode(String?.self, forKey: .summary),
                observed_at: try container.decode(Date.self, forKey: .observed_at)
            )
        case "notfound":
            self = .notfound(
                target_symbol: try container.decode(String.self, forKey: .target_symbol),
                dimension: try container.decode(String.self, forKey: .dimension)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let signal, let status, let severity, let summary, let observed_at):
            try container.encode("ok", forKey: .variant)
            try container.encode(signal, forKey: .signal)
            try container.encode(status, forKey: .status)
            try container.encode(severity, forKey: .severity)
            try container.encode(summary, forKey: .summary)
            try container.encode(observed_at, forKey: .observed_at)
        case .notfound(let target_symbol, let dimension):
            try container.encode("notfound", forKey: .variant)
            try container.encode(target_symbol, forKey: .target_symbol)
            try container.encode(dimension, forKey: .dimension)
        }
    }
}

struct QualitySignalRollupInput: Codable {
    let target_symbols: [String]
    let dimensions: [String]?
}

enum QualitySignalRollupOutput: Codable {
    case ok(results: [(target: String, status: String, blocking: Bool)])

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
                results: try container.decode([(target: String, status: String, blocking: Bool)].self, forKey: .results)
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

struct QualitySignalExplainInput: Codable {
    let target_symbol: String
    let dimensions: [String]?
}

enum QualitySignalExplainOutput: Codable {
    case ok(contributors: [(dimension: String, status: String, severity: String, observed_at: Date, summary: String?, artifact_path: String?, artifact_hash: String?, run_ref: String?)])

    enum CodingKeys: String, CodingKey {
        case variant
        case contributors
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                contributors: try container.decode([(dimension: String, status: String, severity: String, observed_at: Date, summary: String?, artifact_path: String?, artifact_hash: String?, run_ref: String?)].self, forKey: .contributors)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let contributors):
            try container.encode("ok", forKey: .variant)
            try container.encode(contributors, forKey: .contributors)
        }
    }
}
