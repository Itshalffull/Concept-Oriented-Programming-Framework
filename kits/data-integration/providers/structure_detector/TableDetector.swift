// Table detector — detects tabular structure in text content
// Supports: Markdown pipe tables, TSV, space-aligned columns, HTML tables

import Foundation

private struct TableData {
    let headers: [String]
    let rows: [[String]]
    let format: String
}

public final class TableDetectorProvider {

    public init() {}

    private func splitPipeRow(_ row: String) -> [String] {
        let parts = row.split(separator: "|", omittingEmptySubsequences: false).map { $0.trimmingCharacters(in: .whitespaces) }
        var result: [String] = []
        let start = parts.first?.isEmpty == true ? 1 : 0
        let end = parts.last?.isEmpty == true ? parts.count - 1 : parts.count
        for i in start..<end { result.append(parts[i]) }
        return result
    }

    private func parsePipeTable(_ lines: [String]) -> TableData? {
        var pipeLines: [String] = []
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.contains("|") && trimmed.split(separator: "|").count >= 2 {
                pipeLines.append(trimmed)
            } else if pipeLines.count >= 2 {
                break
            } else {
                pipeLines.removeAll()
            }
        }
        guard pipeLines.count >= 3 else { return nil }

        // Separator check
        let sepSet = CharacterSet(charactersIn: "|: -")
        guard pipeLines[1].unicodeScalars.allSatisfy({ sepSet.contains($0) }) else { return nil }

        let headers = splitPipeRow(pipeLines[0])
        let rows = pipeLines[2...].map { splitPipeRow($0) }
        return TableData(headers: headers, rows: Array(rows), format: "markdown_pipe")
    }

    private func parseTsvTable(_ lines: [String]) -> TableData? {
        let tsvLines = lines.filter { $0.contains("\t") && $0.split(separator: "\t").count >= 2 }
        guard tsvLines.count >= 2 else { return nil }

        let colCount = tsvLines[0].split(separator: "\t", omittingEmptySubsequences: false).count
        let consistent = tsvLines.allSatisfy { $0.split(separator: "\t", omittingEmptySubsequences: false).count == colCount }
        guard consistent else { return nil }

        let headers = tsvLines[0].split(separator: "\t", omittingEmptySubsequences: false).map { $0.trimmingCharacters(in: .whitespaces) }
        let rows = tsvLines[1...].map { line in
            line.split(separator: "\t", omittingEmptySubsequences: false).map { $0.trimmingCharacters(in: .whitespaces) }
        }
        return TableData(headers: headers, rows: Array(rows), format: "tsv")
    }

    private func parseHtmlTable(_ text: String) -> TableData? {
        guard let tableRegex = try? NSRegularExpression(pattern: "(?is)<table[^>]*>(.*?)</table>"),
              let tableMatch = tableRegex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
              let innerRange = Range(tableMatch.range(at: 1), in: text) else { return nil }

        let inner = String(text[innerRange])
        guard let rowRegex = try? NSRegularExpression(pattern: "(?is)<tr[^>]*>(.*?)</tr>"),
              let cellRegex = try? NSRegularExpression(pattern: "(?is)<(?:td|th)[^>]*>(.*?)</(?:td|th)>"),
              let tagRegex = try? NSRegularExpression(pattern: "<[^>]+>") else { return nil }

        var allRows: [[String]] = []
        for rowMatch in rowRegex.matches(in: inner, range: NSRange(inner.startIndex..., in: inner)) {
            guard let rr = Range(rowMatch.range(at: 1), in: inner) else { continue }
            let rowContent = String(inner[rr])
            var cells: [String] = []
            for cellMatch in cellRegex.matches(in: rowContent, range: NSRange(rowContent.startIndex..., in: rowContent)) {
                guard let cr = Range(cellMatch.range(at: 1), in: rowContent) else { continue }
                let raw = String(rowContent[cr])
                let clean = tagRegex.stringByReplacingMatches(in: raw, range: NSRange(raw.startIndex..., in: raw), withTemplate: "")
                cells.append(clean.trimmingCharacters(in: .whitespaces))
            }
            if !cells.isEmpty { allRows.append(cells) }
        }
        guard allRows.count >= 2 else { return nil }

        return TableData(headers: allRows[0], rows: Array(allRows[1...]), format: "html")
    }

    private func tableToValue(_ table: TableData) -> [String: Any] {
        return [
            "headers": table.headers,
            "rows": table.rows,
            "format": table.format
        ]
    }

    public func detect(content: Any, existingStructure: [String: Any], config: DetectorConfig) throws -> [Detection] {
        let text: String
        if let s = content as? String { text = s }
        else { text = String(describing: content) }

        let threshold = config.confidenceThreshold ?? 0.5
        var detections: [Detection] = []
        let lines = text.components(separatedBy: .newlines)

        // Pipe table
        if let table = parsePipeTable(lines) {
            let consistent = table.rows.allSatisfy { $0.count == table.headers.count }
            let conf = consistent ? 0.95 : 0.85
            if conf >= threshold {
                detections.append(Detection(
                    field: "table", value: tableToValue(table), type: "table",
                    confidence: conf,
                    evidence: "markdown_pipe table: \(table.headers.count) columns, \(table.rows.count) rows"
                ))
            }
        }

        // TSV
        if let table = parseTsvTable(lines) {
            if 0.90 >= threshold {
                detections.append(Detection(
                    field: "table", value: tableToValue(table), type: "table",
                    confidence: 0.90,
                    evidence: "tsv table: \(table.headers.count) columns, \(table.rows.count) rows"
                ))
            }
        }

        // HTML
        if let table = parseHtmlTable(text) {
            if 0.92 >= threshold {
                detections.append(Detection(
                    field: "table", value: tableToValue(table), type: "table",
                    confidence: 0.92,
                    evidence: "html table: \(table.headers.count) columns, \(table.rows.count) rows"
                ))
            }
        }

        return detections
    }

    public func appliesTo(contentType: String) -> Bool {
        ["text/plain", "text/html", "text/markdown", "text/csv", "text/tab-separated-values"].contains(contentType)
    }
}
