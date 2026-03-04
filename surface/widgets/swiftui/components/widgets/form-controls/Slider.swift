// ============================================================
// Clef Surface SwiftUI Widget — Slider
//
// Range input slider using SwiftUI Slider with an optional
// label and value readout.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// Slider view for range input selection.
///
/// - Parameters:
///   - value: Binding to the current value.
///   - min: Minimum value.
///   - max: Maximum value.
///   - step: Step increment (0 for continuous).
///   - label: Optional label text.
///   - enabled: Whether the slider is enabled.
///   - showValue: Whether to show the percentage.
struct SliderView: View {
    @Binding var value: Float
    var min: Float = 0
    var max: Float = 100
    var step: Float = 0
    var label: String? = nil
    var enabled: Bool = true
    var showValue: Bool = true

    private var percent: Int {
        let ratio = max > min ? (value - min) / (max - min) : 0
        return Int(ratio * 100)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let label = label {
                Text(label)
                    .font(.headline)
            }

            HStack(spacing: 8) {
                if step > 0 {
                    SwiftUI.Slider(
                        value: Binding(
                            get: { Double(value) },
                            set: { value = Float($0) }
                        ),
                        in: Double(min)...Double(max),
                        step: Double(step)
                    )
                    .disabled(!enabled)
                } else {
                    SwiftUI.Slider(
                        value: Binding(
                            get: { Double(value) },
                            set: { value = Float($0) }
                        ),
                        in: Double(min)...Double(max)
                    )
                    .disabled(!enabled)
                }

                if showValue {
                    Text("\(percent)%")
                        .font(.caption)
                        .frame(minWidth: 40, alignment: .trailing)
                }
            }
        }
        .accessibilityValue("\(percent) percent")
    }
}
