// generated: RetryPolicy/Types.swift

import Foundation

struct RetryPolicyCreateInput: Codable {
    let stepRef: String
    let runRef: String
    let maxAttempts: Int
    let initialIntervalMs: Int
    let backoffCoefficient: Double
    let maxIntervalMs: Int
}

enum RetryPolicyCreateOutput: Codable {
    case ok(policy: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case policy
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                policy: try container.decode(String.self, forKey: .policy)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let policy):
            try container.encode("ok", forKey: .variant)
            try container.encode(policy, forKey: .policy)
        }
    }
}

struct RetryPolicyShouldRetryInput: Codable {
    let policy: String
    let error: String
}

enum RetryPolicyShouldRetryOutput: Codable {
    case retry(policy: String, delayMs: Int, attempt: Int)
    case exhausted(policy: String, stepRef: String, runRef: String, lastError: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case policy
        case delayMs
        case attempt
        case stepRef
        case runRef
        case lastError
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "retry":
            self = .retry(
                policy: try container.decode(String.self, forKey: .policy),
                delayMs: try container.decode(Int.self, forKey: .delayMs),
                attempt: try container.decode(Int.self, forKey: .attempt)
            )
        case "exhausted":
            self = .exhausted(
                policy: try container.decode(String.self, forKey: .policy),
                stepRef: try container.decode(String.self, forKey: .stepRef),
                runRef: try container.decode(String.self, forKey: .runRef),
                lastError: try container.decode(String.self, forKey: .lastError)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .retry(let policy, let delayMs, let attempt):
            try container.encode("retry", forKey: .variant)
            try container.encode(policy, forKey: .policy)
            try container.encode(delayMs, forKey: .delayMs)
            try container.encode(attempt, forKey: .attempt)
        case .exhausted(let policy, let stepRef, let runRef, let lastError):
            try container.encode("exhausted", forKey: .variant)
            try container.encode(policy, forKey: .policy)
            try container.encode(stepRef, forKey: .stepRef)
            try container.encode(runRef, forKey: .runRef)
            try container.encode(lastError, forKey: .lastError)
        }
    }
}

struct RetryPolicyRecordAttemptInput: Codable {
    let policy: String
    let error: String
}

enum RetryPolicyRecordAttemptOutput: Codable {
    case ok(policy: String, attemptCount: Int)

    enum CodingKeys: String, CodingKey {
        case variant
        case policy
        case attemptCount
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                policy: try container.decode(String.self, forKey: .policy),
                attemptCount: try container.decode(Int.self, forKey: .attemptCount)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let policy, let attemptCount):
            try container.encode("ok", forKey: .variant)
            try container.encode(policy, forKey: .policy)
            try container.encode(attemptCount, forKey: .attemptCount)
        }
    }
}

struct RetryPolicyMarkSucceededInput: Codable {
    let policy: String
}

enum RetryPolicyMarkSucceededOutput: Codable {
    case ok(policy: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case policy
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                policy: try container.decode(String.self, forKey: .policy)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let policy):
            try container.encode("ok", forKey: .variant)
            try container.encode(policy, forKey: .policy)
        }
    }
}
