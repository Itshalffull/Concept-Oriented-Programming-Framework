// ============================================================
// Clef Surface SwiftUI Widget — Tooltip
//
// Lightweight floating label that provides supplementary
// descriptive text for a trigger element. In SwiftUI, uses
// the .help modifier for basic tooltips and a popover for
// rich tooltips.
//
// Adapts the tooltip.widget spec to SwiftUI rendering.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// Tooltip view providing supplementary descriptive text.
///
/// - Parameters:
///   - content: Descriptive text displayed in the tooltip.
///   - trigger: Trigger element that anchors the tooltip.
struct TooltipView<Trigger: View>: View {
    var content: String
    @ViewBuilder var trigger: Trigger

    var body: some View {
        trigger
            .help(content)
    }
}

/// Rich tooltip variant with title and descriptive body text.
///
/// - Parameters:
///   - title: Heading text displayed in the tooltip.
///   - description: Body text with additional details.
///   - actionLabel: Optional action label text.
///   - onAction: Callback fired when the action is activated.
///   - trigger: Trigger element that anchors the tooltip.
struct RichTooltipView<Trigger: View>: View {
    var title: String
    var description: String
    var actionLabel: String? = nil
    var onAction: (() -> Void)? = nil
    @ViewBuilder var trigger: Trigger

    @State private var isShowing = false

    var body: some View {
        trigger
            .onLongPressGesture {
                isShowing = true
            }
            .popover(isPresented: $isShowing) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                    Text(description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                    if let actionLabel = actionLabel, let onAction = onAction {
                        SwiftUI.Button(actionLabel, action: onAction)
                            .font(.caption)
                    }
                }
                .padding(12)
            }
    }
}
