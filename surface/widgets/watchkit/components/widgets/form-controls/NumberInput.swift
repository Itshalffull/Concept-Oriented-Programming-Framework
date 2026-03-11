// ============================================================
// Clef Surface WatchKit Widget — NumberInput
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct NumberInputView: View {
    @Binding var value: Double
    var range: ClosedRange<Double> = 0...100
    var step: Double = 1
    var body: some View { HStack { Text("\(Int(value))").font(.caption.monospacedDigit()); Stepper("", value: $value, in: range, step: step).labelsHidden() } }
}
