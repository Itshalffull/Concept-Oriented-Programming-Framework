// ============================================================
// Clef Surface SwiftUI Widget — ViewToggle
//
// Control for switching between list and grid display modes.
// Renders as a segmented toggle with icon buttons.
// ============================================================

import SwiftUI

// --------------- Types ---------------

enum ViewMode: String { case list, grid }

// --------------- Component ---------------

/// ViewToggle for switching between display modes.
///
/// - Parameters:
///   - mode: Binding to the current view mode.
///   - onModeChange: Callback when the mode changes.
struct ViewToggleView: View {
    @Binding var mode: ViewMode
    var onModeChange: ((ViewMode) -> Void)? = nil

    var body: some View {
        HStack(spacing: 0) {
            SwiftUI.Button(action: {
                mode = .list
                onModeChange?(.list)
            }) {
                Image(systemName: "list.bullet")
                    .padding(8)
                    .background(mode == .list ? Color.accentColor.opacity(0.1) : Color.clear)
                    .foregroundColor(mode == .list ? .accentColor : .secondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("List view")

            SwiftUI.Button(action: {
                mode = .grid
                onModeChange?(.grid)
            }) {
                Image(systemName: "square.grid.2x2")
                    .padding(8)
                    .background(mode == .grid ? Color.accentColor.opacity(0.1) : Color.clear)
                    .foregroundColor(mode == .grid ? .accentColor : .secondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Grid view")
        }
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color(.systemGray4), lineWidth: 1)
        )
    }
}
