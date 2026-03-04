// ============================================================
// Clef Surface SwiftUI Widget — Textarea
//
// Multi-line text input area using TextEditor with optional
// character count and label.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// Textarea view for multi-line text input.
///
/// - Parameters:
///   - value: Binding to the text value.
///   - placeholder: Placeholder text.
///   - minLines: Minimum number of visible lines.
///   - enabled: Whether the textarea is enabled.
///   - label: Optional label text.
///   - maxLength: Optional maximum character count.
struct TextareaView: View {
    @Binding var value: String
    var placeholder: String = ""
    var minLines: Int = 3
    var enabled: Bool = true
    var label: String? = nil
    var maxLength: Int? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let label = label {
                Text(label)
                    .font(.headline)
            }

            ZStack(alignment: .topLeading) {
                TextEditor(text: Binding(
                    get: { value },
                    set: { newValue in
                        if let maxLength = maxLength, newValue.count > maxLength {
                            return
                        }
                        value = newValue
                    }
                ))
                .frame(minHeight: CGFloat(minLines) * 20)
                .disabled(!enabled)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color(.systemGray4), lineWidth: 1)
                )

                if value.isEmpty && !placeholder.isEmpty {
                    Text(placeholder)
                        .foregroundColor(.secondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 10)
                        .allowsHitTesting(false)
                }
            }

            if let maxLength = maxLength {
                HStack {
                    Spacer()
                    Text("\(value.count) / \(maxLength)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
    }
}
