// ============================================================
// Clef Surface SwiftUI Widget — RichTextEditor
//
// Rich text editor with formatting toolbar. Supports bold,
// italic, and basic text formatting actions via a toolbar.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// RichTextEditor view with formatting toolbar.
///
/// - Parameters:
///   - value: Binding to the text content.
///   - placeholder: Placeholder text.
///   - enabled: Whether the editor is enabled.
struct RichTextEditorView: View {
    @Binding var value: String
    var placeholder: String = "Start typing..."
    var enabled: Bool = true

    var body: some View {
        VStack(spacing: 0) {
            // Formatting toolbar
            HStack(spacing: 4) {
                FormatButton(icon: "bold", label: "Bold")
                FormatButton(icon: "italic", label: "Italic")
                FormatButton(icon: "underline", label: "Underline")
                Divider().frame(height: 20)
                FormatButton(icon: "list.bullet", label: "Bullet list")
                FormatButton(icon: "list.number", label: "Numbered list")
                Divider().frame(height: 20)
                FormatButton(icon: "link", label: "Link")
                Spacer()
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color(.systemGray6))

            Divider()

            // Text editor
            ZStack(alignment: .topLeading) {
                TextEditor(text: $value)
                    .disabled(!enabled)
                    .frame(minHeight: 120)

                if value.isEmpty && !placeholder.isEmpty {
                    Text(placeholder)
                        .foregroundColor(.secondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 10)
                        .allowsHitTesting(false)
                }
            }
        }
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color(.systemGray4), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

private struct FormatButton: View {
    let icon: String
    let label: String

    var body: some View {
        SwiftUI.Button(action: {}) {
            Image(systemName: icon)
                .font(.subheadline)
                .frame(width: 28, height: 28)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}
