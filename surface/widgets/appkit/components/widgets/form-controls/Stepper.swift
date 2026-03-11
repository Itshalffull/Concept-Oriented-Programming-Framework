// ============================================================
// Clef Surface AppKit Widget — Stepper
//
// Increment/decrement control with label display.
// Wraps NSStepper with a paired value label.
// ============================================================

import AppKit

public class ClefStepperView: NSView {
    public var value: Int = 0 { didSet { syncDisplay() } }
    public var minValue: Int = 0
    public var maxValue: Int = 100
    public var step: Int = 1
    public var onValueChange: ((Int) -> Void)?

    private let valueLabel = NSTextField(labelWithString: "0")
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
        valueLabel.font = NSFont.monospacedDigitSystemFont(ofSize: 14, weight: .regular)
        valueLabel.alignment = .center
        addSubview(valueLabel)

        stepper.target = self
        stepper.action = #selector(stepperChanged)
        addSubview(stepper)
        syncDisplay()
    }

    private func syncDisplay() {
        valueLabel.stringValue = "\(value)"
        stepper.integerValue = value
        stepper.minValue = Double(minValue)
        stepper.maxValue = Double(maxValue)
        stepper.increment = Double(step)
    }

    @objc private func stepperChanged() {
        value = stepper.integerValue
        onValueChange?(value)
    }

    public override func layout() {
        super.layout()
        let stepperWidth: CGFloat = 20
        valueLabel.frame = NSRect(x: 0, y: 0, width: bounds.width - stepperWidth - 8, height: bounds.height)
        stepper.frame = NSRect(x: bounds.width - stepperWidth, y: 0, width: stepperWidth, height: bounds.height)
    }
}
