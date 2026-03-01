// generated: LLMCall/Types.swift

import Foundation

struct LLMCallRequestInput: Codable {
    let stepRef: String
    let model: String
    let prompt: Data
    let outputSchema: String
    let maxAttempts: Int
}

enum LLMCallRequestOutput: Codable {
    case ok(call: String, stepRef: String, model: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case call
        case stepRef
        case model
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                call: try container.decode(String.self, forKey: .call),
                stepRef: try container.decode(String.self, forKey: .stepRef),
                model: try container.decode(String.self, forKey: .model)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let call, let stepRef, let model):
            try container.encode("ok", forKey: .variant)
            try container.encode(call, forKey: .call)
            try container.encode(stepRef, forKey: .stepRef)
            try container.encode(model, forKey: .model)
        }
    }
}

struct LLMCallRecordResponseInput: Codable {
    let call: String
    let rawOutput: Data
    let inputTokens: Int
    let outputTokens: Int
}

enum LLMCallRecordResponseOutput: Codable {
    case ok(call: String)
    case providerError(call: String, message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case call
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                call: try container.decode(String.self, forKey: .call)
            )
        case "providerError":
            self = .providerError(
                call: try container.decode(String.self, forKey: .call),
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let call):
            try container.encode("ok", forKey: .variant)
            try container.encode(call, forKey: .call)
        case .providerError(let call, let message):
            try container.encode("providerError", forKey: .variant)
            try container.encode(call, forKey: .call)
            try container.encode(message, forKey: .message)
        }
    }
}

struct LLMCallValidateInput: Codable {
    let call: String
}

enum LLMCallValidateOutput: Codable {
    case valid(call: String, stepRef: String, validatedOutput: Data)
    case invalid(call: String, errors: String, attemptCount: Int, maxAttempts: Int)

    enum CodingKeys: String, CodingKey {
        case variant
        case call
        case stepRef
        case validatedOutput
        case errors
        case attemptCount
        case maxAttempts
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "valid":
            self = .valid(
                call: try container.decode(String.self, forKey: .call),
                stepRef: try container.decode(String.self, forKey: .stepRef),
                validatedOutput: try container.decode(Data.self, forKey: .validatedOutput)
            )
        case "invalid":
            self = .invalid(
                call: try container.decode(String.self, forKey: .call),
                errors: try container.decode(String.self, forKey: .errors),
                attemptCount: try container.decode(Int.self, forKey: .attemptCount),
                maxAttempts: try container.decode(Int.self, forKey: .maxAttempts)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .valid(let call, let stepRef, let validatedOutput):
            try container.encode("valid", forKey: .variant)
            try container.encode(call, forKey: .call)
            try container.encode(stepRef, forKey: .stepRef)
            try container.encode(validatedOutput, forKey: .validatedOutput)
        case .invalid(let call, let errors, let attemptCount, let maxAttempts):
            try container.encode("invalid", forKey: .variant)
            try container.encode(call, forKey: .call)
            try container.encode(errors, forKey: .errors)
            try container.encode(attemptCount, forKey: .attemptCount)
            try container.encode(maxAttempts, forKey: .maxAttempts)
        }
    }
}

struct LLMCallRepairInput: Codable {
    let call: String
    let errors: String
}

enum LLMCallRepairOutput: Codable {
    case ok(call: String)
    case maxAttemptsReached(call: String, stepRef: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case call
        case stepRef
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                call: try container.decode(String.self, forKey: .call)
            )
        case "maxAttemptsReached":
            self = .maxAttemptsReached(
                call: try container.decode(String.self, forKey: .call),
                stepRef: try container.decode(String.self, forKey: .stepRef)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let call):
            try container.encode("ok", forKey: .variant)
            try container.encode(call, forKey: .call)
        case .maxAttemptsReached(let call, let stepRef):
            try container.encode("maxAttemptsReached", forKey: .variant)
            try container.encode(call, forKey: .call)
            try container.encode(stepRef, forKey: .stepRef)
        }
    }
}

struct LLMCallAcceptInput: Codable {
    let call: String
}

enum LLMCallAcceptOutput: Codable {
    case ok(call: String, stepRef: String, output: Data)

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
        }
    }
}

struct LLMCallRejectInput: Codable {
    let call: String
    let reason: String
}

enum LLMCallRejectOutput: Codable {
    case ok(call: String, stepRef: String, reason: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case call
        case stepRef
        case reason
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                call: try container.decode(String.self, forKey: .call),
                stepRef: try container.decode(String.self, forKey: .stepRef),
                reason: try container.decode(String.self, forKey: .reason)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let call, let stepRef, let reason):
            try container.encode("ok", forKey: .variant)
            try container.encode(call, forKey: .call)
            try container.encode(stepRef, forKey: .stepRef)
            try container.encode(reason, forKey: .reason)
        }
    }
}
