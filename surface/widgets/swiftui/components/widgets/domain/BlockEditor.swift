// ============================================================
// Clef Surface SwiftUI Widget — BlockEditor
//
// Full block-based document editor. Each line is an independently
// typed block (paragraph, heading, list, quote, code) that can be
// reordered, converted, and edited.
// ============================================================

import SwiftUI

struct EditorBlock: Identifiable {
    let id: String
    let type: String
    let content: String
}

private let typeIcons: [String: String] = [
    "paragraph": "\u{00B6}",
    "heading": "H",
    "heading-1": "H1",
    "heading-2": "H2",
    "heading-3": "H3",
    "list": "\u{2022}",
    "bulleted-list": "\u{2022}",
    "numbered-list": "#",
    "quote": "\u{201C}",
    "code": "<>",
    "divider": "\u{2014}",
    "callout": "!",
    "toggle": "\u{25B6}",
]

struct BlockEditorView: View {
    var blocks: [EditorBlock]
    var activeBlockId: String? = nil
    var onBlockClick: (String) -> Void = { _ in }
    var onAddBlock: (String?) -> Void = { _ in }
    var onRemoveBlock: (String) -> Void = { _ in }
    var onUpdateBlock: (String, String) -> Void = { _, _ in }

    var body: some View {
        if blocks.isEmpty {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(.systemGray6))
                .frame(maxWidth: .infinity)
                .frame(height: 60)
                .overlay(
                    Text("Type '/' for commands...")
                        .foregroundColor(.secondary)
                        .font(.body)
                )
                .padding(8)
        } else {
            ScrollView {
                LazyVStack(spacing: 4) {
                    ForEach(blocks) { block in
                        let isActive = block.id == activeBlockId
                        let icon = typeIcons[block.type] ?? "\u{00B6}"

                        SwiftUI.Button(action: { onBlockClick(block.id) }) {
                            HStack(spacing: 8) {
                                Text(icon)
                                    .font(.caption)
                                    .foregroundColor(.secondary)

                                Text(block.content.isEmpty ? "(empty)" : block.content)
                                    .font(fontForBlockType(block.type))
                                    .foregroundColor(block.content.isEmpty ? .secondary : .primary)

                                Spacer()
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(isActive ? Color.accentColor.opacity(0.1) : Color(.systemBackground))
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 6)
                                    .stroke(Color(.systemGray4), lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(block.type) block: \(block.content)")
                    }
                }
            }
            .padding(8)
        }
    }

    private func fontForBlockType(_ type: String) -> Font {
        if type.hasPrefix("heading") {
            return .headline.bold()
        }
        if type == "code" {
            return .body.monospaced()
        }
        if type == "quote" {
            return .body.italic()
        }
        return .body
    }
}
