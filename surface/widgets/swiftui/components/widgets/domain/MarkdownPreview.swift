// ============================================================
// Clef Surface SwiftUI Widget — MarkdownPreview
//
// Live markdown rendering widget. Transforms raw markdown source
// into a VStack of styled Text elements: headings as bold text,
// bold/italic via font modifiers, bullets for lists, indented
// styled text for blockquotes, and monospace text for code blocks.
// ============================================================

import SwiftUI

private enum RenderedLine: Identifiable {
    case heading(level: Int, content: String)
    case boldLine(content: String)
    case textLine(content: String)
    case bullet(content: String)
    case quote(content: String)
    case code(content: String)
    case hr
    case blank

    var id: String {
        switch self {
        case .heading(let l, let c): return "h\(l)-\(c)"
        case .boldLine(let c): return "b-\(c)"
        case .textLine(let c): return "t-\(c)"
        case .bullet(let c): return "li-\(c)"
        case .quote(let c): return "q-\(c)"
        case .code(let c): return "c-\(c)"
        case .hr: return "hr-\(UUID().uuidString)"
        case .blank: return "blank-\(UUID().uuidString)"
        }
    }
}

private func parseMarkdown(_ source: String) -> [RenderedLine] {
    let lines = source.components(separatedBy: "\n")
    var result: [RenderedLine] = []
    var inCodeBlock = false

    for line in lines {
        if line.hasPrefix("```") {
            inCodeBlock.toggle()
            if inCodeBlock {
                result.append(.code("--- code ---"))
            }
            continue
        }

        if inCodeBlock {
            result.append(.code(line))
            continue
        }

        let trimmed = line.trimmingCharacters(in: .whitespaces)

        if trimmed.isEmpty {
            result.append(.blank)
            continue
        }

        // Headings
        if let match = trimmed.range(of: #"^(#{1,6})\s+(.*)"#, options: .regularExpression) {
            let hashPart = String(trimmed[trimmed.startIndex..<trimmed.firstIndex(of: " ")!])
            let content = String(trimmed[trimmed.index(after: trimmed.firstIndex(of: " ")!)...])
            result.append(.heading(level: hashPart.count, content: content))
            continue
        }

        // Horizontal rule
        if trimmed.range(of: #"^[-*_]{3,}$"#, options: .regularExpression) != nil {
            result.append(.hr)
            continue
        }

        // Blockquote
        if trimmed.hasPrefix("> ") {
            result.append(.quote(String(trimmed.dropFirst(2))))
            continue
        }

        // Bullet list
        if trimmed.range(of: #"^[-*+]\s"#, options: .regularExpression) != nil {
            result.append(.bullet(String(trimmed.dropFirst(2))))
            continue
        }

        // Numbered list
        if let match = trimmed.range(of: #"^\d+\.\s(.*)"#, options: .regularExpression) {
            let content = String(trimmed[trimmed.range(of: #"(?<=\d+\.\s).*"#, options: .regularExpression)!])
            result.append(.bullet(content))
            continue
        }

        // Bold text line
        if trimmed.hasPrefix("**") && trimmed.hasSuffix("**") && trimmed.count > 4 {
            result.append(.boldLine(String(trimmed.dropFirst(2).dropLast(2))))
            continue
        }

        // Regular text
        result.append(.textLine(trimmed))
    }

    return result
}

struct MarkdownPreviewView: View {
    var content: String

    var body: some View {
        let parsed = parseMarkdown(content)

        VStack(alignment: .leading, spacing: 2) {
            ForEach(Array(parsed.enumerated()), id: \.offset) { _, line in
                switch line {
                case .heading(let level, let text):
                    Text(text)
                        .font(level <= 1 ? .title : level == 2 ? .title2 : level == 3 ? .title3 : .headline)
                        .fontWeight(.bold)
                        .foregroundColor(.accentColor)
                        .padding(.vertical, 4)

                case .boldLine(let text):
                    Text(text)
                        .fontWeight(.bold)
                        .padding(.vertical, 2)

                case .bullet(let text):
                    HStack(alignment: .top, spacing: 8) {
                        Text("\u{2022}")
                            .foregroundColor(.accentColor)
                        Text(text)
                    }
                    .padding(.leading, 8)
                    .padding(.vertical, 2)

                case .quote(let text):
                    HStack(alignment: .top, spacing: 8) {
                        Text("\u{2502}")
                            .foregroundColor(Color(.systemGray3))
                        Text(text)
                            .italic()
                            .foregroundColor(.secondary)
                    }
                    .padding(.leading, 16)
                    .padding(.vertical, 2)

                case .code(let text):
                    Text(text)
                        .font(.system(size: 13, design: .monospaced))
                        .foregroundColor(Color(red: 0.86, green: 0.86, blue: 0.67))
                        .padding(.leading, 16)
                        .padding(.vertical, 1)

                case .hr:
                    Divider()
                        .padding(.vertical, 8)

                case .blank:
                    Spacer().frame(height: 8)

                case .textLine(let text):
                    Text(text)
                        .padding(.vertical, 2)
                }
            }
        }
        .padding(8)
    }
}
