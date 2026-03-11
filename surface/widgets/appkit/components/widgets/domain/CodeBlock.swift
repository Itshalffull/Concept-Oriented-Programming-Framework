// ============================================================
// Clef Surface AppKit Widget — CodeBlock
//
// Syntax-highlighted code display with line numbers, copy
// button, and language label. Read-only code presentation.
// ============================================================

import AppKit

public class ClefCodeBlockView: NSView {
    public var code: String = "" { didSet { updateDisplay() } }
    public var language: String = "" { didSet { langLabel.stringValue = language } }
    public var showLineNumbers: Bool = true { didSet { updateDisplay() } }
    public var onCopy: (() -> Void)?

    private let scrollView = NSScrollView()
    private let textView = NSTextView()
    private let langLabel = NSTextField(labelWithString: "")
    private let copyButton = NSButton()

    public override init(frame frameRect: NSRect) { super.init(frame: frameRect); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        wantsLayer = true
        layer?.cornerRadius = 8
        layer?.backgroundColor = NSColor(white: 0.12, alpha: 1).cgColor

        textView.isEditable = false
        textView.font = NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)
        textView.textColor = .white
        textView.backgroundColor = .clear
        textView.isVerticallyResizable = true

        scrollView.documentView = textView
        scrollView.hasVerticalScroller = true
        scrollView.drawsBackground = false
        scrollView.borderType = .noBorder
        addSubview(scrollView)

        langLabel.font = NSFont.systemFont(ofSize: 10, weight: .medium)
        langLabel.textColor = NSColor.white.withAlphaComponent(0.5)
        addSubview(langLabel)

        copyButton.bezelStyle = .inline
        copyButton.image = NSImage(systemSymbolName: "doc.on.clipboard", accessibilityDescription: "Copy")
        copyButton.isBordered = false
        copyButton.contentTintColor = NSColor.white.withAlphaComponent(0.5)
        copyButton.target = self
        copyButton.action = #selector(handleCopy)
        addSubview(copyButton)
    }

    @objc private func handleCopy() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(code, forType: .string)
        onCopy?()
    }

    private func updateDisplay() {
        if showLineNumbers {
            let lines = code.split(separator: "\n", omittingEmptySubsequences: false)
            let numbered = lines.enumerated().map { "\(String(format: "%3d", $0.offset + 1))  \($0.element)" }.joined(separator: "\n")
            textView.string = numbered
        } else {
            textView.string = code
        }
    }

    public override func layout() {
        super.layout()
        langLabel.frame = NSRect(x: 12, y: bounds.height - 22, width: 100, height: 16)
        copyButton.frame = NSRect(x: bounds.width - 32, y: bounds.height - 28, width: 24, height: 24)
        scrollView.frame = NSRect(x: 0, y: 0, width: bounds.width, height: bounds.height - 28)
    }
}
