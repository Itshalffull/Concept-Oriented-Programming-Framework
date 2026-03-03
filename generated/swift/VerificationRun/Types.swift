// generated: VerificationRun/Types.swift

import Foundation

struct VerificationRunStartInput: Codable {
    let target_symbol: String
    let properties: [String]
    let solver: String
    let timeout_ms: Int
}

enum VerificationRunStartOutput: Codable {
    case ok(run: String)
    case invalid(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case run
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                run: try container.decode(String.self, forKey: .run)
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
        case .ok(let run):
            try container.encode("ok", forKey: .variant)
            try container.encode(run, forKey: .run)
        case .invalid(let message):
            try container.encode("invalid", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct VerificationRunCompleteInput: Codable {
    let run: String
    let results: Data
    let resource_usage: Data
}

enum VerificationRunCompleteOutput: Codable {
    case ok(run: String, proved: Int, refuted: Int, unknown: Int)
    case notfound(run: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case run
        case proved
        case refuted
        case unknown
        case run
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                run: try container.decode(String.self, forKey: .run),
                proved: try container.decode(Int.self, forKey: .proved),
                refuted: try container.decode(Int.self, forKey: .refuted),
                unknown: try container.decode(Int.self, forKey: .unknown)
            )
        case "notfound":
            self = .notfound(
                run: try container.decode(String.self, forKey: .run)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let run, let proved, let refuted, let unknown):
            try container.encode("ok", forKey: .variant)
            try container.encode(run, forKey: .run)
            try container.encode(proved, forKey: .proved)
            try container.encode(refuted, forKey: .refuted)
            try container.encode(unknown, forKey: .unknown)
        case .notfound(let run):
            try container.encode("notfound", forKey: .variant)
            try container.encode(run, forKey: .run)
        }
    }
}

struct VerificationRunTimeoutInput: Codable {
    let run: String
    let partial_results: Data
}

enum VerificationRunTimeoutOutput: Codable {
    case ok(run: String, completed_count: Int, remaining_count: Int)

    enum CodingKeys: String, CodingKey {
        case variant
        case run
        case completed_count
        case remaining_count
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                run: try container.decode(String.self, forKey: .run),
                completed_count: try container.decode(Int.self, forKey: .completed_count),
                remaining_count: try container.decode(Int.self, forKey: .remaining_count)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let run, let completed_count, let remaining_count):
            try container.encode("ok", forKey: .variant)
            try container.encode(run, forKey: .run)
            try container.encode(completed_count, forKey: .completed_count)
            try container.encode(remaining_count, forKey: .remaining_count)
        }
    }
}

struct VerificationRunCancelInput: Codable {
    let run: String
}

enum VerificationRunCancelOutput: Codable {
    case ok(run: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case run
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                run: try container.decode(String.self, forKey: .run)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let run):
            try container.encode("ok", forKey: .variant)
            try container.encode(run, forKey: .run)
        }
    }
}

struct VerificationRunGet_statusInput: Codable {
    let run: String
}

enum VerificationRunGet_statusOutput: Codable {
    case ok(run: String, status: String, progress: Double)

    enum CodingKeys: String, CodingKey {
        case variant
        case run
        case status
        case progress
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                run: try container.decode(String.self, forKey: .run),
                status: try container.decode(String.self, forKey: .status),
                progress: try container.decode(Double.self, forKey: .progress)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let run, let status, let progress):
            try container.encode("ok", forKey: .variant)
            try container.encode(run, forKey: .run)
            try container.encode(status, forKey: .status)
            try container.encode(progress, forKey: .progress)
        }
    }
}

struct VerificationRunCompareInput: Codable {
    let run1: String
    let run2: String
}

enum VerificationRunCompareOutput: Codable {
    case ok(regressions: [String], improvements: [String], unchanged: [String])

    enum CodingKeys: String, CodingKey {
        case variant
        case regressions
        case improvements
        case unchanged
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                regressions: try container.decode([String].self, forKey: .regressions),
                improvements: try container.decode([String].self, forKey: .improvements),
                unchanged: try container.decode([String].self, forKey: .unchanged)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let regressions, let improvements, let unchanged):
            try container.encode("ok", forKey: .variant)
            try container.encode(regressions, forKey: .regressions)
            try container.encode(improvements, forKey: .improvements)
            try container.encode(unchanged, forKey: .unchanged)
        }
    }
}
