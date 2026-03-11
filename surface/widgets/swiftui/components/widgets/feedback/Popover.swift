// ============================================================
// Clef Surface SwiftUI Widget — Popover
//
// Non-modal floating content panel anchored to a trigger
// element. Displays supplementary information or controls
// without blocking interaction with the rest of the page.
//
// Adapts the popover.widget spec to SwiftUI rendering.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// Popover view for non-modal floating content.
///
/// - Parameters:
///   - open: Binding to whether the popover is visible.
///   - title: Optional heading labelling the popover content.
///   - onClose: Callback fired when the popover is dismissed.
///   - popoverContent: Content displayed inside the popover.
///   - trigger: Trigger element rendered inline.
struct PopoverView<PopoverContent: View, Trigger: View>: View {
    @Binding var open: Bool
    var title: String? = nil
    var onClose: (() -> Void)? = nil
    @ViewBuilder var popoverContent: PopoverContent
    @ViewBuilder var trigger: Trigger

    var body: some View {
        trigger
            .popover(isPresented: $open) {
                VStack(alignment: .leading, spacing: 0) {
                    if let title = title {
                        HStack {
                            Text(title)
                                .font(.subheadline)
                                .fontWeight(.semibold)
                            Spacer()
                            SwiftUI.Button(action: {
                                open = false
                                onClose?()
                            }) {
                                Image(systemName: "xmark")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Close popover")
                        }
                        .padding(.bottom, 8)

                        Divider()
                            .padding(.bottom, 12)
                    }

                    popoverContent
                }
                .padding(16)
                .frame(minWidth: 280)
            }
            .onChange(of: open) { _, newValue in
                if !newValue {
                    onClose?()
                }
            }
    }
}
