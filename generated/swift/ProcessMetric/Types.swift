// generated: ProcessMetric/Types.swift

import Foundation

struct ProcessMetricRecordInput: Codable {
    let metricName: String
    let metricValue: Double
    let dimensions: Data
}

enum ProcessMetricRecordOutput: Codable {
    case ok(metric: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case metric
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                metric: try container.decode(String.self, forKey: .metric)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let metric):
            try container.encode("ok", forKey: .variant)
            try container.encode(metric, forKey: .metric)
        }
    }
}

struct ProcessMetricQueryInput: Codable {
    let metricName: String
    let from: String
    let to: String
}

enum ProcessMetricQueryOutput: Codable {
    case ok(metrics: Data, count: Int)

    enum CodingKeys: String, CodingKey {
        case variant
        case metrics
        case count
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                metrics: try container.decode(Data.self, forKey: .metrics),
                count: try container.decode(Int.self, forKey: .count)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let metrics, let count):
            try container.encode("ok", forKey: .variant)
            try container.encode(metrics, forKey: .metrics)
            try container.encode(count, forKey: .count)
        }
    }
}

struct ProcessMetricAggregateInput: Codable {
    let metricName: String
    let aggregation: String
    let from: String
    let to: String
}

enum ProcessMetricAggregateOutput: Codable {
    case ok(value: Double, sampleCount: Int)

    enum CodingKeys: String, CodingKey {
        case variant
        case value
        case sampleCount
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                value: try container.decode(Double.self, forKey: .value),
                sampleCount: try container.decode(Int.self, forKey: .sampleCount)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let value, let sampleCount):
            try container.encode("ok", forKey: .variant)
            try container.encode(value, forKey: .value)
            try container.encode(sampleCount, forKey: .sampleCount)
        }
    }
}
