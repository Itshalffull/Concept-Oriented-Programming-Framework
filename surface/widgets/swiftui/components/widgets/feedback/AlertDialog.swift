// ============================================================
// Clef Surface SwiftUI Widget — AlertDialog
//
// Confirmation dialog requiring an explicit user action before
// dismissal. Used for destructive operations and critical
// confirmations.
//
// Adapts the alert-dialog.widget spec to SwiftUI rendering.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// AlertDialog view requiring an explicit confirm or cancel action.
///
/// - Parameters:
///   - open: Binding to whether the dialog is visible.
///   - title: Heading that labels the alert dialog.
///   - description: Text explaining the action and consequences.
///   - cancelLabel: Label for the cancel action.
///   - confirmLabel: Label for the confirm action.
///   - onCancel: Callback fired when the user cancels.
///   - onConfirm: Callback fired when the user confirms.
struct AlertDialogView: View {
    @Binding var open: Bool
    var title: String? = nil
    var description: String? = nil
    var cancelLabel: String = "Cancel"
    var confirmLabel: String = "Confirm"
    var onCancel: (() -> Void)? = nil
    var onConfirm: (() -> Void)? = nil

    var body: some View {
        EmptyView()
            .alert(title ?? "Confirm", isPresented: $open) {
                SwiftUI.Button(cancelLabel, role: .cancel) {
                    onCancel?()
                }
                SwiftUI.Button(confirmLabel, role: .destructive) {
                    onConfirm?()
                }
            } message: {
                if let description = description {
                    Text(description)
                }
            }
    }
}
