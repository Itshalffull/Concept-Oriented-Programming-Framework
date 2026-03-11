// ============================================================
// Clef Surface SwiftUI Widget — CodeBlock
//
// Syntax-highlighted code display block rendered with monospace
// text. Shows optional line numbers, highlighted lines with a
// tinted background, and a copyable indicator in the header.
// ============================================================

import SwiftUI

struct CodeBlockView: View {
    var code: String
    var language: String = "plaintext"
    var showLineNumbers: Bool = true
    var highlightLines: Set<Int> = []
    var copyable: Bool = false
    var onCopy: (String) -> Void = { _ in }

    @State private var copied = false

    var body: some View {
        let lines = code.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        let gutterWidth = showLineNumbers ? max(String(lines.count).count + 1, 3) : 0

        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Text(language)
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundColor(Color(red: 0.86, green: 0.86, blue: 0.67))

                Spacer()

                if copyable {
                    SwiftUI.Button(action: {
                        onCopy(code)
                        copied = true
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                            copied = false
                        }
                    }) {
                        Text(copied ? "Copied!" : "Copy")
                            .font(.caption2)
                            .foregroundColor(copied ? Color(red: 0.31, green: 0.79, blue: 0.69) : Color(red: 0.61, green: 0.86, blue: 0.99))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)

            // Code lines
            ScrollView(.horizontal, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(lines.enumerated()), id: \.offset) { index, line in
                        let lineNum = index + 1
                        let isHighlighted = highlightLines.contains(lineNum)

                        HStack(spacing: 0) {
                            if showLineNumbers {
                                Text(String(lineNum).padding(toLength: gutterWidth, withPad: " ", startingAt: 0))
                                    .font(.system(size: 13, design: .monospaced))
                                    .foregroundColor(Color(white: 0.52))
                                    .frame(minWidth: CGFloat(gutterWidth * 8), alignment: .trailing)

                                Spacer().frame(width: 12)
                            }

                            Text(line)
                                .font(.system(size: 13, design: .monospaced))
                                .foregroundColor(Color(red: 0.83, green: 0.83, blue: 0.83))
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 1)
                        .background(isHighlighted ? Color(red: 0.15, green: 0.31, blue: 0.47) : Color.clear)
                    }
                }
                .padding(.vertical, 4)
            }

            Spacer().frame(height: 8)
        }
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(red: 0.12, green: 0.12, blue: 0.12))
        )
    }
}
