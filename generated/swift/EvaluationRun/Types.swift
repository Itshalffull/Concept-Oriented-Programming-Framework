// generated: EvaluationRun/Types.swift

import Foundation

struct EvaluationRunRunEvalInput: Codable {
    let stepRef: String
    let evaluatorType: String
    let input: Data
    let threshold: Double
}

enum EvaluationRunRunEvalOutput: Codable {
    case ok(eval: String, stepRef: String, evaluatorType: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case eval
        case stepRef
        case evaluatorType
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                eval: try container.decode(String.self, forKey: .eval),
                stepRef: try container.decode(String.self, forKey: .stepRef),
                evaluatorType: try container.decode(String.self, forKey: .evaluatorType)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let eval, let stepRef, let evaluatorType):
            try container.encode("ok", forKey: .variant)
            try container.encode(eval, forKey: .eval)
            try container.encode(stepRef, forKey: .stepRef)
            try container.encode(evaluatorType, forKey: .evaluatorType)
        }
    }
}

struct EvaluationRunLogMetricInput: Codable {
    let eval: String
    let metricName: String
    let metricValue: Double
}

enum EvaluationRunLogMetricOutput: Codable {
    case ok(eval: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case eval
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                eval: try container.decode(String.self, forKey: .eval)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let eval):
            try container.encode("ok", forKey: .variant)
            try container.encode(eval, forKey: .eval)
        }
    }
}

struct EvaluationRunPassInput: Codable {
    let eval: String
    let score: Double
    let feedback: String
}

enum EvaluationRunPassOutput: Codable {
    case ok(eval: String, stepRef: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case eval
        case stepRef
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                eval: try container.decode(String.self, forKey: .eval),
                stepRef: try container.decode(String.self, forKey: .stepRef)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let eval, let stepRef):
            try container.encode("ok", forKey: .variant)
            try container.encode(eval, forKey: .eval)
            try container.encode(stepRef, forKey: .stepRef)
        }
    }
}

struct EvaluationRunFailInput: Codable {
    let eval: String
    let score: Double
    let feedback: String
}

enum EvaluationRunFailOutput: Codable {
    case failed(eval: String, stepRef: String, feedback: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case eval
        case stepRef
        case feedback
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "failed":
            self = .failed(
                eval: try container.decode(String.self, forKey: .eval),
                stepRef: try container.decode(String.self, forKey: .stepRef),
                feedback: try container.decode(String.self, forKey: .feedback)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .failed(let eval, let stepRef, let feedback):
            try container.encode("failed", forKey: .variant)
            try container.encode(eval, forKey: .eval)
            try container.encode(stepRef, forKey: .stepRef)
            try container.encode(feedback, forKey: .feedback)
        }
    }
}

struct EvaluationRunGetResultInput: Codable {
    let eval: String
}

enum EvaluationRunGetResultOutput: Codable {
    case ok(eval: String, status: String, score: Double, feedback: String)
    case notFound(eval: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case eval
        case status
        case score
        case feedback
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                eval: try container.decode(String.self, forKey: .eval),
                status: try container.decode(String.self, forKey: .status),
                score: try container.decode(Double.self, forKey: .score),
                feedback: try container.decode(String.self, forKey: .feedback)
            )
        case "notFound":
            self = .notFound(
                eval: try container.decode(String.self, forKey: .eval)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let eval, let status, let score, let feedback):
            try container.encode("ok", forKey: .variant)
            try container.encode(eval, forKey: .eval)
            try container.encode(status, forKey: .status)
            try container.encode(score, forKey: .score)
            try container.encode(feedback, forKey: .feedback)
        case .notFound(let eval):
            try container.encode("notFound", forKey: .variant)
            try container.encode(eval, forKey: .eval)
        }
    }
}
