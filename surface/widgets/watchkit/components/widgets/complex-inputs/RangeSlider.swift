// ============================================================
// Clef Surface WatchKit Widget — RangeSlider
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct RangeSliderView: View {
    @Binding var lowerValue: Double; @Binding var upperValue: Double; var range: ClosedRange<Double> = 0...100
    var body: some View { VStack { Slider(value: $lowerValue, in: range); Slider(value: $upperValue, in: range); Text("\(Int(lowerValue)) - \(Int(upperValue))").font(.caption2) } }
}
