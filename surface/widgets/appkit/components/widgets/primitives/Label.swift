// ============================================================
// Clef Surface AppKit Widget — Label
//
// Accessible text label that associates with a form control.
// Wraps NSTextField label with optional required indicator.
// ============================================================

import AppKit

public class ClefLabel: NSTextField {
    public var required: Bool = false { didSet { updateDisplay() } }

    public convenience init(text: String) {
        self.init(labelWithString: text)
        setup()
    }

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        isEditable = false
        isBezeled = false
        drawsBackground = false
        font = NSFont.systemFont(ofSize: 13, weight: .medium)
    }

    private func updateDisplay() {
        if required {
            let base = stringValue.replacingOccurrences(of: " *", with: "")
            stringValue = base + " *"
            let attrStr = NSMutableAttributedString(string: stringValue)
            let starRange = (stringValue as NSString).range(of: "*")
            attrStr.addAttribute(.foregroundColor, value: NSColor.systemRed, range: starRange)
            attributedStringValue = attrStr
        }
    }
}
