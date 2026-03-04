// ============================================================
// Clef Surface SwiftUI Widget — Gauge
//
// Circular or linear gauge displaying a value within a range.
// Uses SwiftUI Gauge when available, with custom rendering
// fallback.
// ============================================================

import SwiftUI

// --------------- Types ---------------

enum GaugeType { case circular, linear }

// --------------- Component ---------------

/// Gauge view displaying a value within a range.
///
/// - Parameters:
///   - value: Current gauge value.
///   - min: Minimum value.
///   - max: Maximum value.
///   - label: Label for the gauge.
///   - gaugeType: Type of gauge: circular or linear.
///   - color: Fill color for the gauge.
struct GaugeView: View {
    var value: Double
    var min: Double = 0
    var max: Double = 100
    var label: String = ""
    var gaugeType: GaugeType = .circular
    var color: Color = .accentColor

    private var progress: Double {
        let range = max - min
        guard range > 0 else { return 0 }
        return (value - min) / range
    }

    var body: some View {
        VStack(spacing: 8) {
            if gaugeType == .circular {
                ZStack {
                    Circle()
                        .stroke(Color(.systemGray5), lineWidth: 8)
                    Circle()
                        .trim(from: 0, to: CGFloat(progress))
                        .stroke(color, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    Text("\(Int(progress * 100))%")
                        .font(.headline)
                        .fontWeight(.bold)
                }
                .frame(width: 80, height: 80)
            } else {
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color(.systemGray5))
                            .frame(height: 8)
                        RoundedRectangle(cornerRadius: 4)
                            .fill(color)
                            .frame(width: geometry.size.width * CGFloat(progress), height: 8)
                    }
                }
                .frame(height: 8)
            }

            if !label.isEmpty {
                Text(label)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .accessibilityValue("\(Int(progress * 100)) percent")
        .accessibilityLabel(label)
    }
}
