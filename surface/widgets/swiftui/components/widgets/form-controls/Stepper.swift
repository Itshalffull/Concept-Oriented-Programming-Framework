// ============================================================
// Clef Surface SwiftUI Widget — Stepper
//
// Compact increment/decrement control using SwiftUI Stepper
// or custom [-] value [+] layout. Respects min, max, and step.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// Stepper view for compact increment/decrement control.
///
/// - Parameters:
///   - value: Binding to the current integer value.
///   - min: Minimum allowed value.
///   - max: Maximum allowed value.
///   - step: Step increment value.
///   - label: Optional label text.
///   - enabled: Whether the stepper is enabled.
struct StepperView: View {
    @Binding var value: Int
    var min: Int = 0
    var max: Int = 10
    var step: Int = 1
    var label: String? = nil
    var enabled: Bool = true

    private var atMin: Bool { value <= min }
    private var atMax: Bool { value >= max }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let label = label {
                Text(label)
                    .font(.headline)
            }

            HStack(spacing: 0) {
                SwiftUI.Button(action: {
                    let next = Swift.max(value - step, min)
                    if next != value { value = next }
                }) {
                    Image(systemName: "minus")
                        .frame(width: 44, height: 44)
                        .foregroundColor(enabled && !atMin ? .accentColor : .gray)
                }
                .disabled(!enabled || atMin)
                .accessibilityLabel("Decrement")

                Text("\(value)")
                    .font(.headline)
                    .fontWeight(.bold)
                    .frame(minWidth: 48)
                    .multilineTextAlignment(.center)
                    .foregroundColor(enabled ? .primary : .gray)
                    .padding(.horizontal, 16)

                SwiftUI.Button(action: {
                    let next = Swift.min(value + step, max)
                    if next != value { value = next }
                }) {
                    Image(systemName: "plus")
                        .frame(width: 44, height: 44)
                        .foregroundColor(enabled && !atMax ? .accentColor : .gray)
                }
                .disabled(!enabled || atMax)
                .accessibilityLabel("Increment")
            }
        }
    }
}
