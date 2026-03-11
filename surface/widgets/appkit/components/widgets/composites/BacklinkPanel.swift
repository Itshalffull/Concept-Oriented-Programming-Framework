// ============================================================
// Clef Surface AppKit Widget — BacklinkPanel
//
// Panel displaying incoming references/backlinks to the
// current item. Lists linked items with titles and excerpts.
// ============================================================

import AppKit

public class ClefBacklinkPanelView: NSView {
    public struct Backlink {
        public let title: String
        public let excerpt: String
        public let source: String
        public let action: () -> Void
        public init(title: String, excerpt: String = "", source: String = "", action: @escaping () -> Void) {
            self.title = title; self.excerpt = excerpt; self.source = source; self.action = action
        }
    }

    public var backlinks: [Backlink] = [] { didSet { rebuild() } }
    public var title: String = "Backlinks" { didSet { titleLabel.stringValue = title } }

    private let titleLabel = NSTextField(labelWithString: "Backlinks")
    private let scrollView = NSScrollView()
    private let stackView = NSStackView()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        titleLabel.font = NSFont.systemFont(ofSize: 13, weight: .semibold)
        addSubview(titleLabel)
        stackView.orientation = .vertical
        stackView.spacing = 8
        stackView.alignment = .leading
        scrollView.documentView = stackView
        scrollView.hasVerticalScroller = true
        scrollView.drawsBackground = false
        addSubview(scrollView)
    }

    private func rebuild() {
        stackView.arrangedSubviews.forEach { stackView.removeArrangedSubview($0); $0.removeFromSuperview() }
        for (i, bl) in backlinks.enumerated() {
            let row = NSView()
            row.wantsLayer = true
            row.layer?.cornerRadius = 4
            row.layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor
            let t = NSTextField(labelWithString: bl.title)
            t.font = NSFont.systemFont(ofSize: 12, weight: .medium)
            row.addSubview(t)
            let e = NSTextField(labelWithString: bl.excerpt)
            e.font = NSFont.systemFont(ofSize: 11)
            e.textColor = .secondaryLabelColor
            row.addSubview(e)
            let btn = NSButton(title: "Open", target: self, action: #selector(openLink(_:)))
            btn.tag = i
            btn.bezelStyle = .inline
            btn.font = NSFont.systemFont(ofSize: 10)
            row.addSubview(btn)
            stackView.addArrangedSubview(row)
        }
    }

    @objc private func openLink(_ sender: NSButton) {
        guard sender.tag < backlinks.count else { return }
        backlinks[sender.tag].action()
    }

    public override func layout() {
        super.layout()
        titleLabel.frame = NSRect(x: 8, y: bounds.height - 24, width: bounds.width - 16, height: 20)
        scrollView.frame = NSRect(x: 0, y: 0, width: bounds.width, height: bounds.height - 28)
    }
}
