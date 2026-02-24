// List detector — detects bullet, numbered, and checkbox lists in text
// Handles nested items via indentation depth analysis

import Foundation

private struct ListItem {
    var text: String
    let depth: Int
    var checked: Bool?
}

private struct ListBlock {
    let items: [ListItem]
    let listType: String // "bullet", "numbered", "checkbox"
    let nested: Bool
    let startLine: Int
    let endLine: Int
}

public final class ListDetectorProvider {

    public init() {}

    private func measureIndent(_ line: String) -> Int {
        var count = 0
        for ch in line {
            if ch == " " { count += 1 }
            else if ch == "\t" { count += 4 }
            else { break }
        }
        return count / 2
    }

    private func detectListBlocks(_ lines: [String]) -> [ListBlock] {
        guard let bulletRe = try? NSRegularExpression(pattern: #"^(\s*)[-*\u{2022}\u{2023}]\s+(.+)$"#, options: .anchorsMatchLines),
              let numberedRe = try? NSRegularExpression(pattern: #"^(\s*)(?:\d+[.)]|[a-zA-Z][.)]|[ivxlc]+[.)])\s+(.+)$"#, options: .anchorsMatchLines),
              let checkboxRe = try? NSRegularExpression(pattern: #"^(\s*)[-*]\s+\[([xX ])\]\s+(.+)$"#, options: .anchorsMatchLines) else {
            return []
        }

        var blocks: [ListBlock] = []
        var currentItems: [ListItem] = []
        var currentType: String? = nil
        var blockStart = 0

        func flush(_ endLine: Int) {
            if currentItems.count >= 2, let lt = currentType {
                let nested = currentItems.contains { $0.depth > 0 }
                blocks.append(ListBlock(items: currentItems, listType: lt, nested: nested,
                                       startLine: blockStart, endLine: endLine))
            }
            currentItems.removeAll()
            currentType = nil
        }

        func matchLine(_ line: String, regex: NSRegularExpression) -> NSTextCheckingResult? {
            let range = NSRange(line.startIndex..., in: line)
            return regex.firstMatch(in: line, range: range)
        }

        func group(_ match: NSTextCheckingResult, _ idx: Int, in line: String) -> String? {
            guard match.numberOfRanges > idx else { return nil }
            let r = match.range(at: idx)
            guard r.location != NSNotFound, let swiftRange = Range(r, in: line) else { return nil }
            return String(line[swiftRange])
        }

        for (i, rawLine) in lines.enumerated() {
            let trimmed = rawLine.replacingOccurrences(of: "\\s+$", with: "", options: .regularExpression)

            if trimmed.trimmingCharacters(in: .whitespaces).isEmpty {
                if !currentItems.isEmpty && i + 1 < lines.count {
                    let next = lines[i + 1]
                    let nr = NSRange(next.startIndex..., in: next)
                    if bulletRe.firstMatch(in: next, range: nr) == nil &&
                       numberedRe.firstMatch(in: next, range: nr) == nil &&
                       checkboxRe.firstMatch(in: next, range: nr) == nil {
                        flush(i - 1)
                    }
                }
                continue
            }

            // Checkbox
            if let m = matchLine(trimmed, regex: checkboxRe), let mark = group(m, 2, in: trimmed), let text = group(m, 3, in: trimmed) {
                if currentType != nil && currentType != "checkbox" { flush(i - 1) }
                if currentType == nil { currentType = "checkbox"; blockStart = i }
                currentItems.append(ListItem(text: text.trimmingCharacters(in: .whitespaces),
                                             depth: measureIndent(trimmed), checked: mark != " "))
                continue
            }

            // Bullet
            if let m = matchLine(trimmed, regex: bulletRe), let text = group(m, 2, in: trimmed) {
                if currentType != nil && currentType != "bullet" { flush(i - 1) }
                if currentType == nil { currentType = "bullet"; blockStart = i }
                currentItems.append(ListItem(text: text.trimmingCharacters(in: .whitespaces),
                                             depth: measureIndent(trimmed)))
                continue
            }

            // Numbered
            if let m = matchLine(trimmed, regex: numberedRe), let text = group(m, 2, in: trimmed) {
                if currentType != nil && currentType != "numbered" { flush(i - 1) }
                if currentType == nil { currentType = "numbered"; blockStart = i }
                currentItems.append(ListItem(text: text.trimmingCharacters(in: .whitespaces),
                                             depth: measureIndent(trimmed)))
                continue
            }

            // Indented continuation
            if !currentItems.isEmpty && measureIndent(trimmed) > 0 {
                currentItems[currentItems.count - 1].text += " " + trimmed.trimmingCharacters(in: .whitespaces)
                continue
            }

            flush(i - 1)
        }

        flush(lines.count - 1)
        return blocks
    }

    public func detect(content: Any, existingStructure: [String: Any], config: DetectorConfig) throws -> [Detection] {
        let text: String
        if let s = content as? String { text = s }
        else { text = String(describing: content) }

        let threshold = config.confidenceThreshold ?? 0.5
        let lines = text.components(separatedBy: .newlines)
        let blocks = detectListBlocks(lines)
        var detections: [Detection] = []

        for block in blocks {
            let count = block.items.count
            var confidence = count >= 5 ? 0.95 : (count >= 3 ? 0.88 : 0.75)
            if block.listType == "checkbox" { confidence = min(confidence + 0.05, 0.99) }
            guard confidence >= threshold else { continue }

            let items: [[String: Any]] = block.items.map { item in
                var entry: [String: Any] = ["text": item.text, "depth": item.depth]
                if let checked = item.checked { entry["checked"] = checked }
                return entry
            }

            detections.append(Detection(
                field: "list",
                value: [
                    "items": items,
                    "type": block.listType,
                    "nested": block.nested,
                    "itemCount": count
                ] as [String: Any],
                type: "list",
                confidence: confidence,
                evidence: "\(block.listType) list with \(count) items (lines \(block.startLine + 1)-\(block.endLine + 1))"
            ))
        }

        return detections
    }

    public func appliesTo(contentType: String) -> Bool {
        ["text/plain", "text/html", "text/markdown"].contains(contentType)
    }
}
