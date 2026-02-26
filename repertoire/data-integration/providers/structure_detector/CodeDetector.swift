// Code block detector — detects fenced code blocks, indented blocks, and inline code
// Classifies language by keyword analysis

import Foundation

private struct LanguageSignature {
    let language: String
    let keywords: [String]
    let patterns: [NSRegularExpression]
}

public final class CodeDetectorProvider {

    private let signatures: [LanguageSignature]

    public init() {
        let specs: [(String, [String], [String])] = [
            ("javascript",
             ["const", "let", "var", "function", "require", "module.exports", "=>", "async", "await"],
             [#"\bconst\s+\w+\s*="#, #"\bfunction\s+\w+\s*\("#, #"\bconsole\.log\b"#]),
            ("typescript",
             ["interface", "type", "enum", "namespace", "implements", "readonly"],
             [#":\s*(string|number|boolean|void|any)\b"#, #"\binterface\s+\w+"#, #"\btype\s+\w+\s*="#]),
            ("python",
             ["def", "import", "from", "class", "self", "elif", "except", "lambda", "yield"],
             [#"\bdef\s+\w+\s*\("#, #"\bimport\s+\w+"#, #"\bfrom\s+\w+\s+import"#, #"\bself\.\w+"#]),
            ("rust",
             ["fn", "let", "mut", "impl", "struct", "enum", "pub", "use", "mod", "match", "trait"],
             [#"\bfn\s+\w+"#, #"\blet\s+mut\s"#, #"\bimpl\s+\w+"#, #"\bpub\s+(fn|struct|enum|mod)\b"#]),
            ("go",
             ["func", "package", "import", "go", "chan", "defer", "select"],
             [#"\bfunc\s+\w+"#, #"\bpackage\s+\w+"#, #":=\s*"#]),
            ("swift",
             ["func", "var", "let", "guard", "protocol", "extension", "struct", "class", "enum"],
             [#"\bguard\s+let"#, #"\bprotocol\s+\w+"#, #"\bextension\s+\w+"#]),
            ("java",
             ["public", "private", "protected", "class", "interface", "extends", "implements"],
             [#"\bpublic\s+class\s+\w+"#, #"\bSystem\.out\."#]),
            ("sql",
             ["SELECT", "FROM", "WHERE", "INSERT", "UPDATE", "DELETE", "CREATE", "JOIN"],
             [#"(?i)\bSELECT\s+.+\s+FROM\b"#, #"(?i)\bCREATE\s+TABLE\b"#]),
        ]
        self.signatures = specs.map { (lang, kws, pats) in
            LanguageSignature(
                language: lang, keywords: kws,
                patterns: pats.compactMap { try? NSRegularExpression(pattern: $0) }
            )
        }
    }

    private func classifyLanguage(_ code: String) -> (language: String, confidence: Double) {
        var bestLang = "unknown"
        var bestScore = 0
        let range = NSRange(code.startIndex..., in: code)

        for sig in signatures {
            var score = 0
            for kw in sig.keywords {
                if code.contains(kw) { score += 1 }
            }
            for pat in sig.patterns {
                if pat.firstMatch(in: code, range: range) != nil { score += 2 }
            }
            if score > bestScore { bestScore = score; bestLang = sig.language }
        }

        let confidence = bestScore >= 6 ? 0.90 : (bestScore >= 3 ? 0.75 : (bestScore >= 1 ? 0.55 : 0.30))
        return (bestLang, confidence)
    }

    public func detect(content: Any, existingStructure: [String: Any], config: DetectorConfig) throws -> [Detection] {
        let text: String
        if let s = content as? String { text = s }
        else { text = String(describing: content) }

        let threshold = config.confidenceThreshold ?? 0.5
        var detections: [Detection] = []
        let fullRange = NSRange(text.startIndex..., in: text)

        // Fenced code blocks
        let fencedRegex = try NSRegularExpression(pattern: #"```(\w*)\n([\s\S]*?)```"#)
        for match in fencedRegex.matches(in: text, range: fullRange) {
            let declared: String
            if match.numberOfRanges > 1, let r = Range(match.range(at: 1), in: text) {
                declared = String(text[r]).lowercased()
            } else { declared = "" }

            guard match.numberOfRanges > 2, let cr = Range(match.range(at: 2), in: text) else { continue }
            let codeContent = String(text[cr]).trimmingCharacters(in: .whitespacesAndNewlines)
            guard !codeContent.isEmpty else { continue }

            let classified = classifyLanguage(codeContent)
            let language = declared.isEmpty ? classified.language : declared
            let confidence = declared.isEmpty ? classified.confidence : 0.98
            guard confidence >= threshold else { continue }

            let lineCount = codeContent.components(separatedBy: .newlines).count
            detections.append(Detection(
                field: "code",
                value: ["language": language, "content": codeContent, "format": "fenced"] as [String: Any],
                type: "code_block",
                confidence: confidence,
                evidence: "Fenced code block (\(language), \(lineCount) lines)"
            ))
        }

        // Indented code blocks
        let lines = text.components(separatedBy: .newlines)
        var block: [String] = []

        func flushIndented() {
            guard block.count >= 2 else { block.removeAll(); return }
            let code = block.joined(separator: "\n")
            let classified = classifyLanguage(code)
            let confidence = min(classified.confidence, 0.80)
            if confidence >= threshold {
                detections.append(Detection(
                    field: "code",
                    value: ["language": classified.language, "content": code, "format": "indented"] as [String: Any],
                    type: "code_block",
                    confidence: confidence,
                    evidence: "Indented code block (\(classified.language), \(block.count) lines)"
                ))
            }
            block.removeAll()
        }

        for line in lines {
            if line.hasPrefix("    ") && line.dropFirst(4).first?.isWhitespace == false {
                block.append(String(line.dropFirst(4)))
            } else if line.hasPrefix("\t") && line.dropFirst().first?.isWhitespace == false {
                block.append(String(line.dropFirst()))
            } else if line.trimmingCharacters(in: .whitespaces).isEmpty && !block.isEmpty {
                block.append("")
            } else {
                flushIndented()
            }
        }
        flushIndented()

        // Inline code
        let inlineRegex = try NSRegularExpression(pattern: #"(?:^|[^`])`([^`\n]+)`(?:[^`]|$)"#)
        var inlineCount = 0
        for match in inlineRegex.matches(in: text, range: fullRange) {
            guard inlineCount < 20 else { break }
            guard let r = Range(match.range(at: 1), in: text) else { continue }
            let code = String(text[r]).trimmingCharacters(in: .whitespaces)
            guard code.count >= 2 && code.count <= 200 else { continue }
            inlineCount += 1

            let confidence = (code.contains("(") || code.contains(".") || code.contains("=")) ? 0.80 : 0.65
            guard confidence >= threshold else { continue }

            let preview = code.count > 50 ? String(code.prefix(50)) : code
            detections.append(Detection(
                field: "code",
                value: ["language": "inline", "content": code, "format": "inline"] as [String: Any],
                type: "code_inline",
                confidence: confidence,
                evidence: "Inline code: `\(preview)`"
            ))
        }

        return detections
    }

    public func appliesTo(contentType: String) -> Bool {
        ["text/plain", "text/html", "text/markdown"].contains(contentType)
    }
}
