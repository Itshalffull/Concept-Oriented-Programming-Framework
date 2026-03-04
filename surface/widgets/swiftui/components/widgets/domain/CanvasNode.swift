// ============================================================
// Clef Surface SwiftUI Widget — CanvasNode
//
// Individual element on a canvas surface rendered as a draggable
// card. Supports selection, label display, position info, and
// drag interaction for repositioning on the canvas.
// ============================================================

import SwiftUI

struct CanvasPosition {
    let x: CGFloat
    let y: CGFloat
}

struct CanvasNodeView: View {
    var id: String
    var label: String
    var position: CanvasPosition = CanvasPosition(x: 0, y: 0)
    var selected: Bool = false
    var type: String? = nil
    var onSelect: (String) -> Void = { _ in }
    var onDrag: (String, CGSize) -> Void = { _, _ in }

    @GestureState private var dragOffset: CGSize = .zero

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label + (type != nil ? " [\(type!)]" : ""))
                .font(.subheadline)
                .fontWeight(selected ? .bold : .regular)
                .foregroundColor(selected ? .accentColor : .primary)

            Text("(\(Int(position.x)), \(Int(position.y)))" + (selected ? " [selected]" : ""))
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(selected ? Color.accentColor.opacity(0.1) : Color(.systemBackground))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(selected ? Color.accentColor : Color(.systemGray3), lineWidth: selected ? 2 : 1)
        )
        .onTapGesture { onSelect(id) }
        .gesture(
            DragGesture()
                .updating($dragOffset) { value, state, _ in
                    state = value.translation
                }
                .onEnded { value in
                    onDrag(id, value.translation)
                }
        )
        .accessibilityLabel("Canvas node: \(label)")
        .accessibilityHint(selected ? "Selected" : "Tap to select")
    }
}
