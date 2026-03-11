// ============================================================
// Clef Surface AppKit Widget — Textarea
//
// Multi-line text editing area using NSTextView inside an
// NSScrollView. Supports placeholder text and character count.
// ============================================================

import AppKit

public class ClefTextarea: NSScrollView {
    public var text: String {
        get { textView.string }
        set { textView.string = newValue }
    }
    public var placeholder: String = "" { didSet { updatePlaceholder() } }
    public var maxLength: Int? = nil
    public var onTextChange: ((String) -> Void)?

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
        hasVerticalScroller = true
        borderType = .bezelBorder

        textView.isRichText = false
        textView.font = NSFont.systemFont(ofSize: 13)
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.autoresizingMask = [.width]
        textView.delegate = self
        documentView = textView
    }

    private func updatePlaceholder() {
        if textView.string.isEmpty {
            textView.string = placeholder
            textView.textColor = .placeholderTextColor
        }
    }
}

extension ClefTextarea: NSTextViewDelegate {
    public func textDidBeginEditing(_ notification: Notification) {
        if textView.string == placeholder {
            textView.string = ""
            textView.textColor = .textColor
        }
    }

    public func textDidChange(_ notification: Notification) {
        if let max = maxLength, textView.string.count > max {
            textView.string = String(textView.string.prefix(max))
        }
        onTextChange?(textView.string)
    }

    public func textDidEndEditing(_ notification: Notification) {
        if textView.string.isEmpty { updatePlaceholder() }
    }
}
