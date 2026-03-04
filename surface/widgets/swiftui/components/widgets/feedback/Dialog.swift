// ============================================================
// Clef Surface SwiftUI Widget — Dialog
//
// Modal overlay that captures focus and blocks interaction with
// the underlying content until dismissed. Supports title bar,
// description, body content, and optional close button.
//
// Adapts the dialog.widget spec to SwiftUI rendering via sheet.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// Dialog view rendered as a modal sheet overlay.
///
/// - Parameters:
///   - open: Binding to whether the dialog is visible.
///   - title: Heading that labels the dialog.
///   - description: Supplementary text explaining the dialog purpose.
///   - closeOnBackPress: Whether the dialog can be dismissed externally.
///   - onClose: Callback fired when the dialog is closed.
///   - content: Composable content rendered inside the dialog body.
struct DialogView<Content: View>: View {
    @Binding var open: Bool
    var title: String? = nil
    var description: String? = nil
    var closeOnBackPress: Bool = true
    var onClose: (() -> Void)? = nil
    @ViewBuilder var content: Content

    var body: some View {
        EmptyView()
            .sheet(isPresented: $open, onDismiss: {
                onClose?()
            }) {
                VStack(alignment: .leading, spacing: 0) {
                    // Title bar
                    if let title = title {
                        HStack {
                            Text(title)
                                .font(.title3)
                                .fontWeight(.semibold)
                            Spacer()
                            if closeOnBackPress {
                                SwiftUI.Button(action: {
                                    open = false
                                    onClose?()
                                }) {
                                    Image(systemName: "xmark")
                                        .foregroundColor(.secondary)
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("Close dialog")
                            }
                        }
                        .padding(.bottom, 8)

                        Divider()
                            .padding(.bottom, 16)
                    }

                    // Description
                    if let description = description {
                        Text(description)
                            .font(.body)
                            .foregroundColor(.secondary)
                            .padding(.bottom, 16)
                    }

                    // Body content
                    content
                }
                .padding(24)
                .interactiveDismissDisabled(!closeOnBackPress)
            }
    }
}
