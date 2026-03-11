// ============================================================
// Clef Surface SwiftUI Widget — HoverCard
//
// Preview card that displays richer content when triggered.
// In SwiftUI, the card is shown via a popover or overlay
// and is controlled via the visible prop.
//
// Adapts the hover-card.widget spec to SwiftUI rendering.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// HoverCard view displaying preview content anchored to a trigger.
///
/// - Parameters:
///   - visible: Binding to whether the hover card is displayed.
///   - onDismiss: Callback when the hover card should be hidden.
///   - cardContent: Content displayed inside the hover card.
///   - trigger: Trigger element rendered inline.
struct HoverCardView<CardContent: View, Trigger: View>: View {
    @Binding var visible: Bool
    var onDismiss: (() -> Void)? = nil
    @ViewBuilder var cardContent: CardContent
    @ViewBuilder var trigger: Trigger

    var body: some View {
        trigger
            .popover(isPresented: $visible) {
                cardContent
                    .padding(16)
                    .frame(minWidth: 200, maxWidth: 320)
            }
            .onChange(of: visible) { _, newValue in
                if !newValue {
                    onDismiss?()
                }
            }
    }
}
