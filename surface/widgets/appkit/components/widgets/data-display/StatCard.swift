// ============================================================
// Clef Surface AppKit Widget — StatCard
//
// Compact card displaying a metric value with label, trend
// indicator, and optional comparison.
// ============================================================

import AppKit

public class ClefStatCardView: NSView {
    public var label: String = "" { didSet { needsDisplay = true } }
    public var value: String = "" { didSet { needsDisplay = true } }
    public var trend: String = "neutral" { didSet { needsDisplay = true } } // up, down, neutral
    public var trendValue: String = "" { didSet { needsDisplay = true } }

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        wantsLayer = true
        layer?.cornerRadius = 8
        layer?.borderWidth = 1
        layer?.borderColor = NSColor.separatorColor.cgColor
        layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
    }

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        let pad: CGFloat = 16

        let labelAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 12),
            .foregroundColor: NSColor.secondaryLabelColor,
        ]
        (label as NSString).draw(at: NSPoint(x: pad, y: bounds.height - 28), withAttributes: labelAttrs)

        let valueAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 28, weight: .bold),
            .foregroundColor: NSColor.labelColor,
        ]
        (value as NSString).draw(at: NSPoint(x: pad, y: bounds.height - 64), withAttributes: valueAttrs)

        let trendColor: NSColor
        let trendIcon: String
        switch trend {
        case "up": trendColor = .systemGreen; trendIcon = "arrow.up"
        case "down": trendColor = .systemRed; trendIcon = "arrow.down"
        default: trendColor = .secondaryLabelColor; trendIcon = "minus"
        }

        let trendAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 12, weight: .medium),
            .foregroundColor: trendColor,
        ]
        (trendValue as NSString).draw(at: NSPoint(x: pad + 18, y: 12), withAttributes: trendAttrs)

        if let img = NSImage(systemSymbolName: trendIcon, accessibilityDescription: nil) {
            let config = NSImage.SymbolConfiguration(pointSize: 10, weight: .medium)
            let colored = img.withSymbolConfiguration(config)
            colored?.draw(in: NSRect(x: pad, y: 12, width: 14, height: 14))
        }
    }
}
