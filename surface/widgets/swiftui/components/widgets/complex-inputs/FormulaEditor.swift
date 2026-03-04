// ============================================================
// Clef Surface SwiftUI Widget — FormulaEditor
//
// Structured formula/expression editor with syntax highlighting
// and function autocomplete. Renders a text editor with monospace
// font and validation feedback.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// FormulaEditor view for structured formula editing.
///
/// - Parameters:
///   - value: Binding to the formula text.
///   - placeholder: Placeholder text.
///   - functions: Available function names for autocomplete.
///   - error: Optional validation error message.
///   - enabled: Whether the editor is enabled.
struct FormulaEditorView: View {
    @Binding var value: String
    var placeholder: String = "Enter formula..."
    var functions: [String] = ["SUM", "AVG", "COUNT", "MIN", "MAX", "IF"]
    var error: String? = nil
    var enabled: Bool = true

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Formula")
                .font(.caption)
                .foregroundColor(.secondary)

            TextEditor(text: $value)
                .font(.system(.body, design: .monospaced))
                .frame(minHeight: 60)
                .padding(8)
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(error != nil ? Color.red : Color(.systemGray4), lineWidth: 1)
                )
                .disabled(!enabled)

            if let error = error {
                Text(error)
                    .font(.caption)
                    .foregroundColor(.red)
            }

            // Function hints
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(functions, id: \.self) { fn in
                        SwiftUI.Button(action: {
                            value += "\(fn)()"
                        }) {
                            Text(fn)
                                .font(.caption)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color(.systemGray5))
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                        .disabled(!enabled)
                    }
                }
            }
        }
    }
}
