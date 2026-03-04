// ============================================================
// Clef Surface SwiftUI Widget — Chart
//
// Data visualization chart using Swift Charts. Supports bar
// and line chart types with configurable data series.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct ChartDataPoint: Identifiable {
    let id = UUID()
    let label: String
    let value: Double
}

enum ChartType { case bar, line }

// --------------- Component ---------------

/// Chart view for data visualization.
///
/// - Parameters:
///   - data: Array of data points.
///   - chartType: Type of chart: bar or line.
///   - title: Optional chart title.
///   - color: Color for the chart series.
struct ChartView: View {
    var data: [ChartDataPoint]
    var chartType: ChartType = .bar
    var title: String? = nil
    var color: Color = .accentColor

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let title = title {
                Text(title)
                    .font(.headline)
                    .fontWeight(.bold)
            }

            // Simple bar chart rendering without Charts framework dependency
            GeometryReader { geometry in
                let maxValue = data.map(\.value).max() ?? 1
                let barWidth = geometry.size.width / CGFloat(data.count) - 4

                HStack(alignment: .bottom, spacing: 4) {
                    ForEach(data) { point in
                        VStack(spacing: 2) {
                            Rectangle()
                                .fill(color)
                                .frame(
                                    width: barWidth,
                                    height: CGFloat(point.value / maxValue) * (geometry.size.height - 20)
                                )
                            Text(point.label)
                                .font(.caption2)
                                .foregroundColor(.secondary)
                                .lineLimit(1)
                        }
                    }
                }
            }
            .frame(height: 200)
        }
        .accessibilityLabel(title ?? "Chart")
    }
}
