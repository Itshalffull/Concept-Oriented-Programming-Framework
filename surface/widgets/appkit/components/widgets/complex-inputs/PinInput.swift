// ============================================================
// Clef Surface AppKit Widget — PinInput
//
// Multi-digit code entry with individual character fields.
// Used for verification codes and PINs.
// ============================================================

import AppKit

public class ClefPinInputView: NSView {
    public var length: Int = 6 { didSet { rebuild() } }
    public var value: String = "" { didSet { syncFields() } }
    public var masked: Bool = false
    public var onComplete: ((String) -> Void)?

    private var fields: [NSTextField] = []
    private let stackView = NSStackView()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        stackView.orientation = .horizontal
        stackView.spacing = 8
        addSubview(stackView)
        rebuild()
    }

    private func rebuild() {
        fields.forEach { stackView.removeArrangedSubview($0); $0.removeFromSuperview() }
        fields = (0..<length).map { _ in
            let tf = NSTextField()
            tf.alignment = .center
            tf.font = NSFont.monospacedDigitSystemFont(ofSize: 20, weight: .medium)
            tf.isBezeled = true
            tf.bezelStyle = .roundedBezel
            tf.delegate = self
            tf.widthAnchor.constraint(equalToConstant: 40).isActive = true
            tf.heightAnchor.constraint(equalToConstant: 48).isActive = true
            return tf
        }
        fields.forEach { stackView.addArrangedSubview($0) }
    }

    private func syncFields() {
        for (i, field) in fields.enumerated() {
            let char = i < value.count ? String(value[value.index(value.startIndex, offsetBy: i)]) : ""
            field.stringValue = masked && !char.isEmpty ? "•" : char
        }
    }

    public override func layout() {
        super.layout()
        stackView.frame = bounds
    }
}

extension ClefPinInputView: NSTextFieldDelegate {
    public func controlTextDidChange(_ obj: Notification) {
        guard let field = obj.object as? NSTextField, let index = fields.firstIndex(of: field) else { return }
        let text = field.stringValue
        if text.count >= 1 {
            let char = String(text.prefix(1))
            field.stringValue = masked ? "•" : char
            var chars = Array(value)
            while chars.count <= index { chars.append(" ") }
            chars[index] = char.first!
            value = String(chars).trimmingCharacters(in: .whitespaces)

            if index + 1 < fields.count {
                window?.makeFirstResponder(fields[index + 1])
            }
            if value.count == length { onComplete?(value) }
        }
    }
}
