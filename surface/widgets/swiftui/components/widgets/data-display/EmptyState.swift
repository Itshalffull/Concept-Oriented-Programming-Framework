// ============================================================
// Clef Surface SwiftUI Widget — EmptyState
//
// Placeholder displayed when a container has no data. Shows
// an icon, title, description, and optional action button.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// EmptyState view for empty data placeholder display.
///
/// - Parameters:
///   - icon: SF Symbol name for the empty state icon.
///   - title: Primary heading text.
///   - description: Optional secondary description text.
///   - actionLabel: Optional action button label.
///   - onAction: Callback for the action button.
struct EmptyStateView: View {
    var icon: String = "tray"
    var title: String = "No data"
    var description: String? = nil
    var actionLabel: String? = nil
    var onAction: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundColor(.secondary)

            Text(title)
                .font(.headline)
                .foregroundColor(.primary)

            if let description = description {
                Text(description)
                    .font(.body)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }

            if let actionLabel = actionLabel, let onAction = onAction {
                SwiftUI.Button(action: onAction) {
                    Text(actionLabel)
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(32)
        .accessibilityLabel(title)
    }
}
