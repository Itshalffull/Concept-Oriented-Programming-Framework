// ============================================================
// Clef Surface AppKit Widget — FormulaEditor
//
// Specialized text editor for mathematical or logical
// formulas with syntax highlighting and validation.
// ============================================================

import AppKit

public class ClefFormulaEditorView: NSView, NSTextViewDelegate {
    public var formula: String {
        get { textView.string }
        set { textView.string = newValue; highlightSyntax() }
    }
    public var valid: Bool = true { didSet { updateValidation() } }
    public var onFormulaChange: ((String) -> Void)?

    private let scrollView = NSScrollView()
    private let textView = NSTextView()
    private let validationLabel = NSTextField(labelWithString: "")

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
        layer?.cornerRadius = 6

        textView.isRichText = false
        textView.font = NSFont.monospacedSystemFont(ofSize: 13, weight: .regular)
        textView.isVerticallyResizable = true
        textView.delegate = self

        scrollView.documentView = textView
        scrollView.hasVerticalScroller = true
        scrollView.borderType = .noBorder
        addSubview(scrollView)

        validationLabel.font = NSFont.systemFont(ofSize: 11)
        validationLabel.isEditable = false
        validationLabel.isBezeled = false
        validationLabel.drawsBackground = false
        addSubview(validationLabel)

        updateValidation()
    }

    private func highlightSyntax() {
        let str = NSMutableAttributedString(string: textView.string)
        let range = NSRange(location: 0, length: str.length)
        str.addAttribute(.font, value: NSFont.monospacedSystemFont(ofSize: 13, weight: .regular), range: range)
        str.addAttribute(.foregroundColor, value: NSColor.labelColor, range: range)

        let operators = ["+", "-", "*", "/", "=", "(", ")", "<", ">"]
        for op in operators {
            var searchRange = NSRange(location: 0, length: str.length)
            while searchRange.location < str.length {
                let found = (str.string as NSString).range(of: op, range: searchRange)
                if found.location == NSNotFound { break }
                str.addAttribute(.foregroundColor, value: NSColor.systemPurple, range: found)
                searchRange.location = found.upperBound
                searchRange.length = str.length - searchRange.location
            }
        }
        textView.textStorage?.setAttributedString(str)
    }

    private func updateValidation() {
        layer?.borderColor = valid ? NSColor.separatorColor.cgColor : NSColor.systemRed.cgColor
        validationLabel.textColor = valid ? .secondaryLabelColor : .systemRed
        validationLabel.stringValue = valid ? "" : "Invalid formula"
    }

    public func textDidChange(_ notification: Notification) {
        highlightSyntax()
        onFormulaChange?(textView.string)
    }

    public override func layout() {
        super.layout()
        scrollView.frame = NSRect(x: 0, y: 20, width: bounds.width, height: bounds.height - 20)
        validationLabel.frame = NSRect(x: 8, y: 0, width: bounds.width - 16, height: 18)
    }
}
