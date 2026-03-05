import SwiftUI

struct QuorumGaugeView: View {
    @State private var state = "belowThreshold"

    var body: some View {
        VStack {
            Text("QuorumGauge")
                .font(.caption)
        }
        .accessibilityLabel("Progress bar with a threshold ")
    }
}
