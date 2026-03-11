// ============================================================
// Clef Surface AppKit Widget — CacheDashboard
//
// Dashboard showing cache statistics: hit rate, size, entries,
// and cache clear actions.
// ============================================================

import AppKit

public class ClefCacheDashboardView: NSView {
    public var hitRate: Double = 0 { didSet { needsDisplay = true } }
    public var totalEntries: Int = 0 { didSet { needsDisplay = true } }
    public var cacheSize: String = "0 KB" { didSet { needsDisplay = true } }
    public var onClear: (() -> Void)?

    private let clearButton = NSButton(title: "Clear Cache", target: nil, action: nil)

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        wantsLayer = true
        layer?.cornerRadius = 8
        layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor
        clearButton.target = self
        clearButton.action = #selector(handleClear)
        clearButton.bezelStyle = .rounded
        addSubview(clearButton)
    }

    @objc private func handleClear() { onClear?() }

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        let titleAttrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 14, weight: .semibold), .foregroundColor: NSColor.labelColor]
        ("Cache Dashboard" as NSString).draw(at: NSPoint(x: 16, y: bounds.height - 28), withAttributes: titleAttrs)

        let statAttrs: [NSAttributedString.Key: Any] = [.font: NSFont.monospacedDigitSystemFont(ofSize: 12, weight: .regular), .foregroundColor: NSColor.secondaryLabelColor]
        ("Hit Rate: \(Int(hitRate * 100))%" as NSString).draw(at: NSPoint(x: 16, y: bounds.height - 52), withAttributes: statAttrs)
        ("Entries: \(totalEntries)" as NSString).draw(at: NSPoint(x: 16, y: bounds.height - 72), withAttributes: statAttrs)
        ("Size: \(cacheSize)" as NSString).draw(at: NSPoint(x: 16, y: bounds.height - 92), withAttributes: statAttrs)
    }

    public override func layout() {
        super.layout()
        clearButton.frame = NSRect(x: 16, y: 12, width: 100, height: 24)
    }
}
