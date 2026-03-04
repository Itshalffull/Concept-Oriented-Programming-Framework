// ============================================================
// Clef Surface AppKit Widget — TextInput
//
// Single-line text input field with placeholder, validation,
// and optional leading/trailing accessory support.
// ============================================================

import AppKit

public class ClefTextInput: NSTextField {
    public var onValueChange: ((String) -> Void)?
    public var validationState: String = "none" { didSet { updateBorder() } }

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        isBezeled = true
        bezelStyle = .roundedBezel
        delegate = self
    }

    private func updateBorder() {
        wantsLayer = true
        switch validationState {
        case "error":
            layer?.borderColor = NSColor.systemRed.cgColor
            layer?.borderWidth = 1.5
        case "success":
            layer?.borderColor = NSColor.systemGreen.cgColor
            layer?.borderWidth = 1.5
        default:
            layer?.borderWidth = 0
        }
    }
}

extension ClefTextInput: NSTextFieldDelegate {
    public func controlTextDidChange(_ obj: Notification) {
        onValueChange?(stringValue)
    }
}
