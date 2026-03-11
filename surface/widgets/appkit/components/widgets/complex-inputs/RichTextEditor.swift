// ============================================================
// Clef Surface AppKit Widget — RichTextEditor
//
// Rich text editing with a formatting toolbar. Supports bold,
// italic, underline, lists, and alignment via NSTextView.
// ============================================================

import AppKit

public class ClefRichTextEditorView: NSView {
    public var attributedText: NSAttributedString {
        get { textView.attributedString() }
        set { textView.textStorage?.setAttributedString(newValue) }
    }
    public var onTextChange: ((NSAttributedString) -> Void)?

    private let toolbar = NSStackView()
    private let scrollView = NSScrollView()
    private let textView = NSTextView()

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
        layer?.borderWidth = 1
        layer?.borderColor = NSColor.separatorColor.cgColor
        layer?.cornerRadius = 6

        // Toolbar
        toolbar.orientation = .horizontal
        toolbar.spacing = 2
        toolbar.edgeInsets = NSEdgeInsets(top: 4, left: 8, bottom: 4, right: 8)
        let actions: [(String, Selector)] = [
            ("bold", #selector(toggleBold)), ("italic", #selector(toggleItalic)),
            ("underline", #selector(toggleUnderline)), ("list.bullet", #selector(insertList)),
            ("text.alignleft", #selector(alignLeft)), ("text.aligncenter", #selector(alignCenter)),
        ]
        for (icon, sel) in actions {
            let btn = NSButton()
            btn.bezelStyle = .inline
            btn.image = NSImage(systemSymbolName: icon, accessibilityDescription: nil)
            btn.target = self
            btn.action = sel
            btn.isBordered = false
            toolbar.addArrangedSubview(btn)
        }
        addSubview(toolbar)

        // Text view
        textView.isRichText = true
        textView.usesRuler = false
        textView.font = NSFont.systemFont(ofSize: 14)
        textView.isVerticallyResizable = true
        textView.delegate = self

        scrollView.documentView = textView
        scrollView.hasVerticalScroller = true
        scrollView.borderType = .noBorder
        addSubview(scrollView)
    }

    @objc private func toggleBold() { textView.toggleBoldface(nil) }
    @objc private func toggleItalic() { textView.toggleItalics(nil) }
    @objc private func toggleUnderline() { textView.toggleUnderline(nil) }
    @objc private func insertList() { textView.insertText("• ", replacementRange: textView.selectedRange()) }
    @objc private func alignLeft() { textView.alignLeft(nil) }
    @objc private func alignCenter() { textView.alignCenter(nil) }

    public override func layout() {
        super.layout()
        toolbar.frame = NSRect(x: 0, y: bounds.height - 36, width: bounds.width, height: 36)
        scrollView.frame = NSRect(x: 0, y: 0, width: bounds.width, height: bounds.height - 37)
    }
}

extension ClefRichTextEditorView: NSTextViewDelegate {
    public func textDidChange(_ notification: Notification) {
        onTextChange?(textView.attributedString())
    }
}
