// ============================================================
// Clef Surface WatchKit Widget — Chart
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct ChartView: View {
    var data: [Double] = []; var labels: [String] = []
    var body: some View {
        HStack(alignment: .bottom, spacing: 2) {
            let maxVal = data.max() ?? 1
            ForEach(0..<data.count, id: \.self) { i in
                VStack(spacing: 2) {
                    Rectangle().fill(Color.accentColor).frame(height: CGFloat(data[i] / maxVal) * 60)
                    if i < labels.count { Text(labels[i]).font(.system(size: 8)) }
                }
            }
        }.frame(height: 80)
    }
}
