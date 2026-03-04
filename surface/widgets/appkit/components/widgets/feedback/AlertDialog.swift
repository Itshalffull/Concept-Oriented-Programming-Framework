// ============================================================
// Clef Surface AppKit Widget — AlertDialog
//
// Modal confirmation dialog with title, message, and action
// buttons. Wraps NSAlert for native macOS alert behavior.
// ============================================================

import AppKit

public class ClefAlertDialog {
    public var title: String = ""
    public var message: String = ""
    public var confirmLabel: String = "OK"
    public var cancelLabel: String = "Cancel"
    public var destructive: Bool = false
    public var onConfirm: (() -> Void)?
    public var onCancel: (() -> Void)?

    public func show(in window: NSWindow? = nil) {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.alertStyle = destructive ? .critical : .informational

        alert.addButton(withTitle: confirmLabel)
        alert.addButton(withTitle: cancelLabel)

        if destructive {
            alert.buttons.first?.hasDestructiveAction = true
        }

        let handler: (NSApplication.ModalResponse) -> Void = { [weak self] response in
            if response == .alertFirstButtonReturn {
                self?.onConfirm?()
            } else {
                self?.onCancel?()
            }
        }

        if let window = window {
            alert.beginSheetModal(for: window, completionHandler: handler)
        } else {
            let response = alert.runModal()
            handler(response)
        }
    }
}
