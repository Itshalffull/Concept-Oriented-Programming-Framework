// ============================================================
// Clef Surface AppKit Widget — WorkflowNode
//
// Specialized canvas node for workflow steps with type badge,
// status indicator, and configuration summary.
// ============================================================

import AppKit

public class ClefWorkflowNodeView: NSView {
    public var nodeTitle: String = "" { didSet { needsDisplay = true } }
    public var nodeType: String = "action" { didSet { needsDisplay = true } } // trigger, condition, action, delay
    public var status: String = "idle" { didSet { needsDisplay = true } } // idle, running, success, error
    public var configSummary: String = "" { didSet { needsDisplay = true } }

    public override init(frame frameRect: NSRect) { super.init(frame: frameRect); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        wantsLayer = true; layer?.cornerRadius = 8; layer?.borderWidth = 1.5
        layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor
    }

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        let borderColor: NSColor
        switch status {
        case "running": borderColor = .systemBlue
        case "success": borderColor = .systemGreen
        case "error": borderColor = .systemRed
        default: borderColor = .separatorColor
        }
        layer?.borderColor = borderColor.cgColor

        // Type badge
        let typeColor: NSColor
        switch nodeType {
        case "trigger": typeColor = .systemPurple
        case "condition": typeColor = .systemOrange
        case "delay": typeColor = .systemYellow
        default: typeColor = .systemBlue
        }
        typeColor.setFill()
        NSBezierPath(roundedRect: NSRect(x: 8, y: bounds.height - 22, width: 60, height: 16), xRadius: 4, yRadius: 4).fill()
        let typeAttrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 9, weight: .bold), .foregroundColor: NSColor.white]
        (nodeType.uppercased() as NSString).draw(at: NSPoint(x: 12, y: bounds.height - 21), withAttributes: typeAttrs)

        // Title
        let titleAttrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 12, weight: .semibold)]
        (nodeTitle as NSString).draw(at: NSPoint(x: 8, y: bounds.height - 42), withAttributes: titleAttrs)

        // Config summary
        let cfgAttrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 10), .foregroundColor: NSColor.secondaryLabelColor]
        (configSummary as NSString).draw(at: NSPoint(x: 8, y: 8), withAttributes: cfgAttrs)
    }
}
