// ============================================================
// Clef Surface AppKit Widget — ToggleSwitch
//
// On/off toggle switch. Uses NSSwitch on macOS 10.15+ or
// falls back to a styled NSButton toggle.
// ============================================================

import AppKit

public class ClefToggleSwitch: NSSwitch {
    public var isOn: Bool {
        get { state == .on }
        set { state = newValue ? .on : .off }
    }
    public var label: String = ""
    public var onToggle: ((Bool) -> Void)?

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        target = self
        action = #selector(handleToggle)
    }

    @objc private func handleToggle() {
        onToggle?(state == .on)
    }
}
