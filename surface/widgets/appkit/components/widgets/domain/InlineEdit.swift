// ============================================================
// Clef Surface AppKit Widget — InlineEdit
//
// Click-to-edit text that toggles between display and edit
// modes. Commits on Enter or blur, reverts on Escape.
// ============================================================

import AppKit

public class ClefInlineEditView: NSView, NSTextFieldDelegate {
    public var value: String = "" { didSet { displayLabel.stringValue = value } }
    public var editing: Bool = false { didSet { toggleMode() } }
    public var onCommit: ((String) -> Void)?

    private let displayLabel = NSTextField(labelWithString: "")
    private let editField = NSTextField()

    public override init(frame frameRect: NSRect) { super.init(frame: frameRect); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        displayLabel.font = NSFont.systemFont(ofSize: 13)
        displayLabel.isEditable = false; displayLabel.isBezeled = false; displayLabel.drawsBackground = false
        addSubview(displayLabel)

        editField.font = NSFont.systemFont(ofSize: 13)
        editField.delegate = self; editField.isHidden = true
        addSubview(editField)

        let click = NSClickGestureRecognizer(target: self, action: #selector(startEditing))
        click.numberOfClicksRequired = 2
        displayLabel.addGestureRecognizer(click)
    }

    @objc private func startEditing() { editing = true }

    private func toggleMode() {
        displayLabel.isHidden = editing
        editField.isHidden = !editing
        if editing {
            editField.stringValue = value
            window?.makeFirstResponder(editField)
        }
    }

    public func controlTextDidEndEditing(_ obj: Notification) {
        value = editField.stringValue; editing = false
        onCommit?(value)
    }

    public func control(_ control: NSControl, textView: NSTextView, doCommandBy commandSelector: Selector) -> Bool {
        if commandSelector == #selector(NSResponder.cancelOperation(_:)) {
            editing = false; return true
        }
        return false
    }

    public override func layout() {
        super.layout()
        displayLabel.frame = bounds; editField.frame = bounds
    }
}
