// ============================================================
// Clef Surface SwiftUI Widget — FloatingToolbar
//
// Floating action toolbar that appears contextually. Contains
// a row of action buttons positioned at a configurable
// alignment within the parent view.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct FloatingToolbarAction: Identifiable {
    let id = UUID()
    let label: String
    var icon: String? = nil
    var disabled: Bool = false
}

// --------------- Component ---------------

/// FloatingToolbar view displaying contextual action buttons.
///
/// - Parameters:
///   - visible: Whether the toolbar is visible.
///   - actions: Array of toolbar actions.
///   - alignment: Position alignment of the toolbar.
///   - onAction: Callback when an action is selected.
struct FloatingToolbarView: View {
    var visible: Bool = true
    var actions: [FloatingToolbarAction]
    var alignment: Alignment = .bottom
    var onAction: ((FloatingToolbarAction) -> Void)? = nil

    var body: some View {
        if visible {
            HStack(spacing: 8) {
                ForEach(actions) { action in
                    SwiftUI.Button(action: {
                        guard !action.disabled else { return }
                        onAction?(action)
                    }) {
                        HStack(spacing: 4) {
                            if let icon = action.icon {
                                Image(systemName: icon)
                            }
                            Text(action.label)
                                .font(.subheadline)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                    }
                    .disabled(action.disabled)
                    .buttonStyle(.bordered)
                    .accessibilityLabel(action.label)
                }
            }
            .padding(12)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .shadow(radius: 8)
        }
    }
}
