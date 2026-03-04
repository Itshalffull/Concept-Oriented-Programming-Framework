// ============================================================
// Clef Surface WatchKit Widget — Stepper
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct StepperView: View {
    var label: String = ""; @Binding var value: Int; var range: ClosedRange<Int> = 0...100
    var body: some View { Stepper(value: $value, in: range) { HStack { Text(label).font(.caption2); Spacer(); Text("\(value)").font(.caption2.monospacedDigit()) } } }
}
