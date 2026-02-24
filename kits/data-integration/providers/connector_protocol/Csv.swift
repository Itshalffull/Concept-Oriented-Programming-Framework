// Csv.swift — connector_protocol provider
// CSV/TSV file reader and writer with configurable delimiters, quote handling, header detection, and streaming

import Foundation

public let csvProviderId = "csv"
public let csvPluginType = "connector_protocol"

public struct CsvConnectorConfig: Codable {
    public var baseUrl: String?; public var connectionString: String?
    public var auth: [String: String]?; public var headers: [String: String]?; public var options: [String: String]?
}
public struct CsvQuerySpec: Codable {
    public var path: String?; public var query: String?; public var params: [String: String]?
    public var cursor: String?; public var limit: Int?
}
public struct CsvWriteResult: Codable { public var created: Int; public var updated: Int; public var skipped: Int; public var errors: Int }
public struct CsvTestResult: Codable { public var connected: Bool; public var message: String; public var latencyMs: Int? }
public struct CsvStreamDef: Codable { public var name: String; public var schema: [String: String]; public var supportedSyncModes: [String] }
public struct CsvDiscoveryResult: Codable { public var streams: [CsvStreamDef] }
public enum CsvConnectorError: Error { case fileNotFound(String); case parseError(String); case writeError(String) }

private struct CsvOptions {
    var delimiter: Character; var quote: Character; var escape: Character
    var hasHeader: Bool; var skipRows: Int; var commentChar: Character?
    var nullValues: Set<String>
}

private func getOptions(_ config: CsvConnectorConfig) -> CsvOptions {
    let delim = config.options?["delimiter"]?.first ?? ","
    return CsvOptions(
        delimiter: delim, quote: Character(config.options?["quote"] ?? "\""),
        escape: Character(config.options?["escape"] ?? "\""),
        hasHeader: (config.options?["hasHeader"] ?? "true") == "true",
        skipRows: Int(config.options?["skipRows"] ?? "0") ?? 0,
        commentChar: config.options?["commentChar"]?.first,
        nullValues: Set(["", "NULL", "null", "NA", "N/A"])
    )
}

private func parseCsvLine(_ line: String, delimiter: Character, quote: Character, escape: Character) -> [String] {
    var fields = [String]()
    var current = ""
    var inQuotes = false
    var chars = line.makeIterator()
    var nextChar = chars.next()

    while let ch = nextChar {
        if inQuotes {
            if ch == escape {
                let peek = chars.next()
                if peek == quote {
                    current.append(quote)
                    nextChar = chars.next()
                } else {
                    inQuotes = false
                    nextChar = peek
                }
            } else {
                current.append(ch)
                nextChar = chars.next()
            }
        } else {
            if ch == quote {
                inQuotes = true
                nextChar = chars.next()
            } else if ch == delimiter {
                fields.append(current)
                current = ""
                nextChar = chars.next()
            } else {
                current.append(ch)
                nextChar = chars.next()
            }
        }
    }
    fields.append(current)
    return fields
}

private func formatCsvField(_ value: String, delimiter: Character, quote: Character) -> String {
    if value.contains(delimiter) || value.contains(quote) || value.contains("\n") {
        let escaped = value.replacingOccurrences(of: String(quote), with: "\(quote)\(quote)")
        return "\(quote)\(escaped)\(quote)"
    }
    return value
}

private func coerceValue(_ value: String, nullValues: Set<String>) -> Any {
    if nullValues.contains(value) { return NSNull() }
    if let intVal = Int(value) { return intVal }
    if let doubleVal = Double(value) { return doubleVal }
    if value == "true" || value == "TRUE" { return true }
    if value == "false" || value == "FALSE" { return false }
    return value
}

private func detectDelimiter(_ sample: String) -> Character {
    let firstLine = sample.split(separator: "\n", maxSplits: 1).first ?? ""
    let candidates: [Character] = [",", "\t", "|", ";"]
    var best: Character = ","
    var bestCount = 0
    for d in candidates {
        let count = firstLine.filter { $0 == d }.count
        if count > bestCount { bestCount = count; best = d }
    }
    return best
}

public final class CsvConnectorProvider {
    public init() {}

    public func read(query: CsvQuerySpec, config: CsvConnectorConfig) async throws -> AsyncStream<[String: Any]> {
        let filePath = query.path ?? config.baseUrl ?? ""
        let opts = getOptions(config)
        let limit = query.limit ?? Int.max
        let startRow = Int(query.cursor ?? "0") ?? 0

        guard let data = FileManager.default.contents(atPath: filePath),
              let content = String(data: data, encoding: .utf8) else {
            throw CsvConnectorError.fileNotFound("Cannot read file at \(filePath)")
        }

        let lines = content.split(separator: "\n", omittingEmptySubsequences: true).map(String.init)
        let delimiter = opts.delimiter == "," ? detectDelimiter(content) : opts.delimiter

        let headerFields: [String]
        let dataStart: Int
        if opts.hasHeader {
            headerFields = parseCsvLine(lines.count > opts.skipRows ? lines[opts.skipRows] : "", delimiter: delimiter, quote: opts.quote, escape: opts.escape)
            dataStart = opts.skipRows + 1
        } else {
            let sample = parseCsvLine(lines.first ?? "", delimiter: delimiter, quote: opts.quote, escape: opts.escape)
            headerFields = sample.indices.map { "column_\($0)" }
            dataStart = opts.skipRows
        }

        return AsyncStream { continuation in
            var yielded = 0
            for i in (dataStart + startRow)..<lines.count {
                if yielded >= limit { break }
                let line = lines[i]
                if let cc = opts.commentChar, line.first == cc { continue }
                let fields = parseCsvLine(line, delimiter: delimiter, quote: opts.quote, escape: opts.escape)
                var record = [String: Any]()
                for (j, header) in headerFields.enumerated() {
                    let val = j < fields.count ? fields[j] : ""
                    record[header] = coerceValue(val, nullValues: opts.nullValues)
                }
                continuation.yield(record)
                yielded += 1
            }
            continuation.finish()
        }
    }

    public func write(records: [[String: Any]], config: CsvConnectorConfig) async throws -> CsvWriteResult {
        let outputPath = config.options?["outputPath"] ?? ""
        if outputPath.isEmpty {
            return CsvWriteResult(created: 0, updated: 0, skipped: records.count, errors: 0)
        }
        let opts = getOptions(config)
        var allKeys = [String]()
        for record in records {
            for key in record.keys where !allKeys.contains(key) { allKeys.append(key) }
        }

        var lines = [String]()
        if opts.hasHeader {
            lines.append(allKeys.map { formatCsvField($0, delimiter: opts.delimiter, quote: opts.quote) }.joined(separator: String(opts.delimiter)))
        }
        for record in records {
            let fields = allKeys.map { key -> String in
                let val = record[key].map { "\($0)" } ?? ""
                return formatCsvField(val, delimiter: opts.delimiter, quote: opts.quote)
            }
            lines.append(fields.joined(separator: String(opts.delimiter)))
        }

        let output = lines.joined(separator: "\n") + "\n"
        try output.write(toFile: outputPath, atomically: true, encoding: .utf8)
        return CsvWriteResult(created: records.count, updated: 0, skipped: 0, errors: 0)
    }

    public func test(config: CsvConnectorConfig) async throws -> CsvTestResult {
        let filePath = config.baseUrl ?? ""
        let start = Date()
        let exists = FileManager.default.fileExists(atPath: filePath)
        let ms = Int(Date().timeIntervalSince(start) * 1000)
        return CsvTestResult(connected: exists, message: exists ? "File exists" : "File not found", latencyMs: ms)
    }

    public func discover(config: CsvConnectorConfig) async throws -> CsvDiscoveryResult {
        let filePath = config.baseUrl ?? ""
        guard let data = FileManager.default.contents(atPath: filePath),
              let content = String(data: data, encoding: .utf8) else {
            return CsvDiscoveryResult(streams: [])
        }
        let delimiter = detectDelimiter(content)
        let firstLine = content.split(separator: "\n", maxSplits: 1).first.map(String.init) ?? ""
        let headers = parseCsvLine(firstLine, delimiter: delimiter, quote: "\"", escape: "\"")
        let name = (filePath as NSString).lastPathComponent
        var schema = [String: String]()
        for h in headers { schema[h] = "string" }
        return CsvDiscoveryResult(streams: [
            CsvStreamDef(name: name, schema: schema, supportedSyncModes: ["full_refresh"])
        ])
    }
}
