// ============================================================
// Clef Surface AppKit Widget — ColorPicker
//
// Color selection control using the native NSColorPanel.
// Displays a color swatch that opens the system color picker.
// ============================================================

import AppKit

public class ClefColorPickerView: NSView {
    public var color: NSColor = .controlAccentColor { didSet { needsDisplay = true } }
    public var onColorChange: ((NSColor) -> Void)?

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        wantsLayer = true
        layer?.cornerRadius = 6
        layer?.borderWidth = 1
        layer?.borderColor = NSColor.separatorColor.cgColor
        let click = NSClickGestureRecognizer(target: self, action: #selector(openPicker))
        addGestureRecognizer(click)
    }

    @objc private func openPicker() {
        let panel = NSColorPanel.shared
        panel.color = color
        panel.setTarget(self)
        panel.setAction(#selector(colorChanged(_:)))
        panel.makeKeyAndOrderFront(nil)
    }

    @objc private func colorChanged(_ sender: NSColorPanel) {
        color = sender.color
        onColorChange?(color)
    }

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        color.setFill()
        NSBezierPath(roundedRect: bounds.insetBy(dx: 2, dy: 2), xRadius: 4, yRadius: 4).fill()
    }

    public override var intrinsicContentSize: NSSize { NSSize(width: 36, height: 36) }
}
