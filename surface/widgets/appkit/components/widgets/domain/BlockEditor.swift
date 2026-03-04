// ============================================================
// Clef Surface AppKit Widget — BlockEditor
//
// Block-based content editor where each paragraph is a
// draggable, typed block (text, heading, code, image, etc.).
// ============================================================

import AppKit

public class ClefBlockEditorView: NSView {
    public struct Block {
        public let id: String
        public var type: String // "text", "heading", "code", "image", "quote"
        public var content: String
        public init(id: String, type: String, content: String) { self.id = id; self.type = type; self.content = content }
    }

    public var blocks: [Block] = [] { didSet { rebuild() } }
    public var onBlocksChange: (([Block]) -> Void)?

    private let scrollView = NSScrollView()
    private let stackView = NSStackView()

    public override init(frame frameRect: NSRect) { super.init(frame: frameRect); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        stackView.orientation = .vertical; stackView.spacing = 4; stackView.alignment = .leading
        scrollView.documentView = stackView; scrollView.hasVerticalScroller = true
        addSubview(scrollView)
    }

    private func rebuild() {
        stackView.arrangedSubviews.forEach { stackView.removeArrangedSubview($0); $0.removeFromSuperview() }
        for block in blocks {
            let row = NSView(); row.wantsLayer = true
            let font: NSFont
            switch block.type {
            case "heading": font = NSFont.systemFont(ofSize: 20, weight: .bold)
            case "code": font = NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)
            default: font = NSFont.systemFont(ofSize: 14)
            }
            let tf = NSTextField(labelWithString: block.content)
            tf.font = font; tf.isEditable = true; tf.isBezeled = false; tf.drawsBackground = false
            tf.frame = NSRect(x: 28, y: 4, width: bounds.width - 48, height: 24)
            row.addSubview(tf)
            let handle = NSTextField(labelWithString: "⋮⋮")
            handle.font = NSFont.systemFont(ofSize: 10); handle.textColor = .tertiaryLabelColor
            handle.frame = NSRect(x: 4, y: 4, width: 20, height: 20)
            row.addSubview(handle)
            row.frame = NSRect(x: 0, y: 0, width: bounds.width - 20, height: 32)
            stackView.addArrangedSubview(row)
        }
    }

    public override func layout() {
        super.layout()
        scrollView.frame = bounds
    }
}
