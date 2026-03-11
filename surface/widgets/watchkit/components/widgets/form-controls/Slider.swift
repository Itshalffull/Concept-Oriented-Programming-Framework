// ============================================================
// Clef Surface WatchKit Widget — Slider
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct SliderView: View {
    @Binding var value: Double; var range: ClosedRange<Double> = 0...100
    var body: some View { VStack { Slider(value: $value, in: range); Text("\(Int(value))").font(.caption2.monospacedDigit()) } }
}
