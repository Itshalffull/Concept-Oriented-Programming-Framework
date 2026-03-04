// ============================================================
// Clef Surface WatchKit Widget — AlertDialog
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct AlertDialogView: View {
    var title: String = ""; var message: String = ""; var confirmLabel: String = "OK"; var cancelLabel: String = "Cancel"
    var onConfirm: () -> Void = {}; var onCancel: () -> Void = {}
    var body: some View {
        VStack(spacing: 8) {
            Text(title).font(.caption.bold()); Text(message).font(.caption2).foregroundColor(.secondary)
            HStack { Button(cancelLabel, role: .cancel, action: onCancel).font(.caption2); Button(confirmLabel, action: onConfirm).font(.caption2) }
        }.padding()
    }
}
