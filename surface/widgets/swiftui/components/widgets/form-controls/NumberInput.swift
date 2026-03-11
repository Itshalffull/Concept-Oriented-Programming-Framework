// ============================================================
// Clef Surface SwiftUI Widget — NumberInput
//
// Numeric input with increment/decrement controls. Renders a
// TextField with number validation and +/- buttons. Respects
// min, max, and step constraints.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// NumberInput view with increment/decrement controls.
///
/// - Parameters:
///   - value: Binding to the current numeric value.
///   - min: Minimum allowed value.
///   - max: Maximum allowed value.
///   - step: Step increment/decrement value.
///   - label: Optional label text.
///   - enabled: Whether the input is enabled.
struct NumberInputView: View {
    @Binding var value: Double
    var min: Double? = nil
    var max: Double? = nil
    var step: Double = 1.0
    var label: String? = nil
    var enabled: Bool = true

    @State private var textValue: String = ""

    private func clamp(_ n: Double) -> Double {
        var result = n
        if let min = min, result < min { result = min }
        if let max = max, result > max { result = max }
        return result
    }

    private var atMin: Bool { min != nil && value <= min! }
    private var atMax: Bool { max != nil && value >= max! }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let label = label {
                Text(label)
                    .font(.headline)
            }

            HStack {
                SwiftUI.Button(action: {
                    value = clamp(value - step)
                }) {
                    Image(systemName: "minus")
                        .frame(width: 44, height: 44)
                }
                .disabled(!enabled || atMin)
                .accessibilityLabel("Decrement")

                TextField("", text: $textValue)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 120)
                    .multilineTextAlignment(.center)
                    .disabled(!enabled)
                    .onChange(of: value) { _, newValue in
                        textValue = formatValue(newValue)
                    }
                    .onChange(of: textValue) { _, newText in
                        if let parsed = Double(newText) {
                            value = clamp(parsed)
                        }
                    }
                    .onAppear {
                        textValue = formatValue(value)
                    }
                #if os(iOS)
                    .keyboardType(.decimalPad)
                #endif

                SwiftUI.Button(action: {
                    value = clamp(value + step)
                }) {
                    Image(systemName: "plus")
                        .frame(width: 44, height: 44)
                }
                .disabled(!enabled || atMax)
                .accessibilityLabel("Increment")
            }
        }
    }

    private func formatValue(_ v: Double) -> String {
        if v == v.rounded() {
            return String(Int(v))
        }
        return String(v)
    }
}
