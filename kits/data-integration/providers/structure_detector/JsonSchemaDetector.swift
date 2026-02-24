// JSON schema detector — infers schema from JSON objects or CSV content
// Detects field types, patterns (email, URL, date, UUID), cardinality, nullability

import Foundation

public final class JsonSchemaDetectorProvider {

    public init() {}

    private struct PatternMatcher {
        let name: String
        let regex: NSRegularExpression
    }

    private lazy var patternMatchers: [PatternMatcher] = {
        let specs: [(String, String)] = [
            ("email", #"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$"#),
            ("url", #"^https?://\S+$"#),
            ("uuid", #"(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"#),
            ("iso_date", #"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?"#),
            ("ipv4", #"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$"#),
            ("phone", #"^\+?\d[\d\s()\-]{6,20}$"#),
        ]
        return specs.compactMap { (name, pattern) in
            guard let re = try? NSRegularExpression(pattern: pattern) else { return nil }
            return PatternMatcher(name: name, regex: re)
        }
    }()

    private func inferType(_ value: Any) -> String {
        if value is NSNull { return "null" }
        if value is Bool { return "boolean" }
        if let n = value as? NSNumber {
            return CFNumberIsFloatType(n) ? "number" : "integer"
        }
        if value is String { return "string" }
        if value is [Any] { return "array" }
        if value is [String: Any] { return "object" }
        return "unknown"
    }

    private func detectPattern(_ value: String) -> String? {
        let range = NSRange(value.startIndex..., in: value)
        for matcher in patternMatchers {
            if matcher.regex.firstMatch(in: value, range: range) != nil {
                return matcher.name
            }
        }
        return nil
    }

    private struct FieldStats {
        var types: [String: Int] = [:]
        var patterns: [String: Int] = [:]
        var nullCount: Int = 0
        var count: Int = 0
    }

    private func analyzeObjects(_ objects: [[String: Any]]) -> [(name: String, type: String, pattern: String?, nullable: Bool, count: Int, total: Int)] {
        var fieldMap: [String: FieldStats] = [:]
        let total = objects.count

        for obj in objects {
            for (key, val) in obj {
                var stats = fieldMap[key] ?? FieldStats()
                stats.count += 1
                let t = inferType(val)
                stats.types[t, default: 0] += 1
                if val is NSNull {
                    stats.nullCount += 1
                } else if let s = val as? String, let pat = detectPattern(s) {
                    stats.patterns[pat, default: 0] += 1
                }
                fieldMap[key] = stats
            }
        }

        return fieldMap.map { (name, stats) in
            let dominantType = stats.types
                .filter { $0.key != "null" }
                .max(by: { $0.value < $1.value })?
                .key ?? "string"

            let nonNull = stats.count - stats.nullCount
            let pattern = stats.patterns.first { (_, count) in
                Double(count) > Double(nonNull) * 0.7
            }?.key

            return (name: name, type: dominantType, pattern: pattern,
                    nullable: stats.nullCount > 0, count: stats.count, total: total)
        }
    }

    private func parseCsvToObjects(_ text: String) -> [[String: Any]] {
        let lines = text.components(separatedBy: .newlines).filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        guard lines.count >= 2 else { return [] }

        let delimiter: Character = lines[0].contains("\t") ? "\t" : ","
        let headers = lines[0].split(separator: delimiter, omittingEmptySubsequences: false)
            .map { $0.trimmingCharacters(in: .whitespaces).trimmingCharacters(in: CharacterSet(charactersIn: "\"")) }

        return lines[1...].map { line in
            let values = line.split(separator: delimiter, omittingEmptySubsequences: false)
                .map { $0.trimmingCharacters(in: .whitespaces).trimmingCharacters(in: CharacterSet(charactersIn: "\"")) }
            var obj: [String: Any] = [:]
            for (i, header) in headers.enumerated() {
                let raw = i < values.count ? values[i] : ""
                if raw.isEmpty || raw.lowercased() == "null" {
                    obj[header] = NSNull()
                } else if let n = Int(raw) {
                    obj[header] = n
                } else if let f = Double(raw), raw.contains(".") {
                    obj[header] = f
                } else if raw.lowercased() == "true" {
                    obj[header] = true
                } else if raw.lowercased() == "false" {
                    obj[header] = false
                } else {
                    obj[header] = raw
                }
            }
            return obj
        }
    }

    public func detect(content: Any, existingStructure: [String: Any], config: DetectorConfig) throws -> [Detection] {
        let threshold = config.confidenceThreshold ?? 0.5
        var objects: [[String: Any]] = []

        if let text = content as? String {
            if let data = text.data(using: .utf8),
               let json = try? JSONSerialization.jsonObject(with: data) {
                if let arr = json as? [[String: Any]] {
                    objects = arr
                } else if let obj = json as? [String: Any] {
                    objects = [obj]
                }
            }
            if objects.isEmpty {
                objects = parseCsvToObjects(text)
            }
        } else if let arr = content as? [[String: Any]] {
            objects = arr
        } else if let obj = content as? [String: Any] {
            objects = [obj]
        }

        guard !objects.isEmpty else { return [] }

        let schemas = analyzeObjects(objects)
        var detections: [Detection] = []
        var fieldNames: [String] = []

        for schema in schemas {
            let cardinality = Double(schema.count) / Double(schema.total)
            var confidence = cardinality >= 1.0 ? 0.95 : 0.80
            if schema.pattern != nil { confidence = min(confidence + 0.03, 0.99) }
            guard confidence >= threshold else { continue }

            fieldNames.append(schema.name)
            let patStr = schema.pattern.map { " (\($0))" } ?? ""
            let nullStr = schema.nullable ? "nullable" : "required"

            detections.append(Detection(
                field: "schema.\(schema.name)",
                value: [
                    "type": schema.type,
                    "pattern": schema.pattern as Any,
                    "nullable": schema.nullable,
                    "cardinality": (cardinality * 100).rounded() / 100,
                    "samples": schema.total
                ] as [String: Any],
                type: "schema_field",
                confidence: confidence,
                evidence: "Field \"\(schema.name)\": \(schema.type)\(patStr), \(nullStr)"
            ))
        }

        if !detections.isEmpty {
            detections.append(Detection(
                field: "schema",
                value: [
                    "fieldCount": schemas.count,
                    "sampleCount": objects.count,
                    "fields": fieldNames
                ] as [String: Any],
                type: "json_schema",
                confidence: 0.90,
                evidence: "Schema with \(schemas.count) fields from \(objects.count) sample(s)"
            ))
        }

        return detections
    }

    public func appliesTo(contentType: String) -> Bool {
        ["application/json", "text/csv", "text/tab-separated-values", "application/x-ndjson"].contains(contentType)
    }
}
