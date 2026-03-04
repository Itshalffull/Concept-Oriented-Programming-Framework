// ============================================================
// Clef Surface SwiftUI Widget — DragHandle
//
// Reorder handle rendered as a grip icon using SF Symbols.
// Purely visual indicator for drag-and-drop reordering
// capability; actual drag logic is managed by parent containers.
// ============================================================

import SwiftUI

struct DragHandleView: View {
    var disabled: Bool = false
    var contentDescription: String = "Drag to reorder"

    var body: some View {
        Image(systemName: "line.3.horizontal")
            .foregroundColor(disabled ? Color(.systemGray4) : .secondary)
            .padding(4)
            .accessibilityLabel(contentDescription)
            .accessibilityAddTraits(.isButton)
            .allowsHitTesting(!disabled)
    }
}
