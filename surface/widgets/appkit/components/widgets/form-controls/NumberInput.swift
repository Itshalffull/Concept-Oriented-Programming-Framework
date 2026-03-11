// ============================================================
// Clef Surface AppKit Widget — NumberInput
//
// Numeric text field with optional stepper, min/max bounds,
// and step increment. Validates numeric input only.
// ============================================================

import AppKit

public class ClefNumberInputView: NSView {
    public var value: Double = 0 { didSet { syncDisplay() } }
    public var minValue: Double = -.infinity
    public var maxValue: Double = .infinity
    public var step: Double = 1
    public var onValueChange: ((Double) -> Void)?

    private let textField = NSTextField()
    private let stepper = NSStepper()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        textField.isBezeled = true
        textField.bezelStyle = .roundedBezel
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        textField.formatter = formatter
        addSubview(textField)

        stepper.target = self
        stepper.action = #selector(stepperChanged)
        addSubview(stepper)

        syncDisplay()
    }

    private func syncDisplay() {
        textField.doubleValue = value
        stepper.doubleValue = value
        stepper.minValue = minValue
        stepper.maxValue = maxValue
        stepper.increment = step
    }

    @objc private func stepperChanged() {
        value = max(minValue, min(maxValue, stepper.doubleValue))
        onValueChange?(value)
    }

    public override func layout() {
        super.layout()
        let stepperWidth: CGFloat = 20
        textField.frame = NSRect(x: 0, y: 0, width: bounds.width - stepperWidth - 4, height: bounds.height)
        stepper.frame = NSRect(x: bounds.width - stepperWidth, y: 0, width: stepperWidth, height: bounds.height)
    }
}
