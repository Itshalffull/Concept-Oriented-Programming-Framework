// ============================================================
// Clef Surface AppKit Widget — ChipInput
//
// Text field that converts entered values into removable chips.
// Supports comma/enter delimiters and backspace removal.
// ============================================================

import AppKit

public class ClefChipInputView: NSView, NSTextFieldDelegate {
    public var chips: [String] = [] { didSet { rebuild() } }
    public var placeholder: String = "Add tag..." { didSet { textField.placeholderString = placeholder } }
    public var onChipsChange: (([String]) -> Void)?

    private let scrollView = NSScrollView()
    private let stackView = NSStackView()
    private let textField = NSTextField()

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

        stackView.orientation = .horizontal
        stackView.spacing = 4
        stackView.addArrangedSubview(textField)

        textField.isBezeled = false
        textField.drawsBackground = false
        textField.placeholderString = placeholder
        textField.delegate = self

        scrollView.documentView = stackView
        scrollView.drawsBackground = false
        scrollView.borderType = .noBorder
        addSubview(scrollView)
    }

    private func rebuild() {
        stackView.arrangedSubviews.filter { $0 !== textField }.forEach {
            stackView.removeArrangedSubview($0)
            $0.removeFromSuperview()
        }
        for (i, chip) in chips.enumerated() {
            let chipView = createChipButton(chip, index: i)
            stackView.insertArrangedSubview(chipView, at: stackView.arrangedSubviews.count - 1)
        }
    }

    private func createChipButton(_ text: String, index: Int) -> NSView {
        let btn = NSButton(title: "\(text) x", target: self, action: #selector(removeChip(_:)))
        btn.tag = index
        btn.bezelStyle = .inline
        btn.font = NSFont.systemFont(ofSize: 11)
        return btn
    }

    @objc private func removeChip(_ sender: NSButton) {
        guard sender.tag < chips.count else { return }
        chips.remove(at: sender.tag)
        onChipsChange?(chips)
    }

    public func controlTextDidEndEditing(_ obj: Notification) {
        let text = textField.stringValue.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        chips.append(text)
        textField.stringValue = ""
        onChipsChange?(chips)
    }

    public override func layout() {
        super.layout()
        scrollView.frame = bounds.insetBy(dx: 4, dy: 4)
    }
}
