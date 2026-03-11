// ============================================================
// Clef Surface WatchKit Widget — Gauge
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct GaugeDisplayView: View {
    var value: Double = 0; var maxValue: Double = 100; var label: String = ""
    var body: some View {
        VStack {
            Gauge(value: value, in: 0...maxValue) { Text(label).font(.caption2) } currentValueLabel: { Text("\(Int(value))").font(.caption.monospacedDigit()) }
            .gaugeStyle(.accessoryCircular)
        }
    }
}
