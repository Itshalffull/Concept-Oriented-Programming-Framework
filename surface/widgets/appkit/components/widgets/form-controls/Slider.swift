// ============================================================
// Clef Surface AppKit Widget — Slider
//
// Continuous or discrete value slider using NSSlider.
// Supports min, max, step, and value display.
// ============================================================

import AppKit

public class ClefSlider: NSSlider {
    public var onValueChanged: ((Double) -> Void)?
    public var step: Double = 0

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        target = self
        action = #selector(handleChange)
        minValue = 0
        maxValue = 100
    }

    @objc private func handleChange() {
        var val = doubleValue
        if step > 0 {
            val = (val / step).rounded() * step
            doubleValue = val
        }
        onValueChanged?(val)
    }
}
