// ============================================================
// Clef Surface SwiftUI Widget — InlineEdit
//
// Click-to-edit inline text display. Shows value as plain Text
// when not editing; switches to a TextField when editing. Enter
// or focus loss confirms, Escape cancels and reverts.
// ============================================================

import SwiftUI

struct InlineEditView: View {
    var value: String
    var placeholder: String = "Click to edit"
    var onSubmit: (String) -> Void = { _ in }
    var onCancel: () -> Void = {}

    @State private var isEditing = false
    @State private var editValue = ""
    @FocusState private var isFocused: Bool

    var body: some View {
        if isEditing {
            HStack(spacing: 4) {
                TextField(placeholder, text: $editValue)
                    .textFieldStyle(.roundedBorder)
                    .focused($isFocused)
                    .onSubmit {
                        onSubmit(editValue)
                        isEditing = false
                    }
                    .onAppear {
                        editValue = value
                        isFocused = true
                    }

                SwiftUI.Button(action: {
                    onSubmit(editValue)
                    isEditing = false
                }) {
                    Image(systemName: "checkmark")
                        .foregroundColor(.accentColor)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Confirm")

                SwiftUI.Button(action: {
                    editValue = value
                    isEditing = false
                    onCancel()
                }) {
                    Image(systemName: "xmark")
                        .foregroundColor(.red)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Cancel")
            }
        } else {
            SwiftUI.Button(action: { isEditing = true }) {
                HStack(spacing: 8) {
                    Text(value.isEmpty ? placeholder : value)
                        .font(.body)
                        .foregroundColor(value.isEmpty ? .secondary : .primary)

                    Image(systemName: "pencil")
                        .foregroundColor(.secondary)
                }
                .padding(8)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(value.isEmpty ? placeholder : value)
            .accessibilityHint("Tap to edit")
        }
    }
}
