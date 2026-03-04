// ============================================================
// Clef Surface AppKit Widget — PluginCard
//
// Card displaying a plugin/extension with icon, name,
// description, version, and enable/disable toggle.
// ============================================================

import AppKit

public class ClefPluginCardView: NSView {
    public var name: String = "" { didSet { needsDisplay = true } }
    public var pluginDescription: String = "" { didSet { needsDisplay = true } }
    public var version: String = "" { didSet { needsDisplay = true } }
    public var icon: String = "puzzlepiece.extension" { didSet { needsDisplay = true } }
    public var enabled: Bool = true { didSet { toggle.state = enabled ? .on : .off } }
    public var onToggle: ((Bool) -> Void)?

    private let toggle = NSSwitch()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        wantsLayer = true
        layer?.cornerRadius = 8
        layer?.borderWidth = 1
        layer?.borderColor = NSColor.separatorColor.cgColor
        layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor
        toggle.target = self
        toggle.action = #selector(handleToggle)
        addSubview(toggle)
    }

    @objc private func handleToggle() { onToggle?(toggle.state == .on) }

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        if let img = NSImage(systemSymbolName: icon, accessibilityDescription: nil) {
            img.draw(in: NSRect(x: 12, y: bounds.height - 36, width: 24, height: 24))
        }
        let nameAttrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 13, weight: .semibold), .foregroundColor: NSColor.labelColor]
        (name as NSString).draw(at: NSPoint(x: 44, y: bounds.height - 28), withAttributes: nameAttrs)

        let verAttrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 10), .foregroundColor: NSColor.tertiaryLabelColor]
        ("v\(version)" as NSString).draw(at: NSPoint(x: 44, y: bounds.height - 42), withAttributes: verAttrs)

        let descAttrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 11), .foregroundColor: NSColor.secondaryLabelColor]
        (pluginDescription as NSString).draw(at: NSPoint(x: 12, y: 12), withAttributes: descAttrs)
    }

    public override func layout() {
        super.layout()
        toggle.frame = NSRect(x: bounds.width - 48, y: bounds.height - 36, width: 36, height: 20)
    }
}
