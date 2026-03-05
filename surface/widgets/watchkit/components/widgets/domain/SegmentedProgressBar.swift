import SwiftUI

struct SegmentedProgressBarView: View {
    @State private var state = "idle"

    var body: some View {
        VStack {
            Text("SegmentedProgressBar")
                .font(.caption)
        }
        .accessibilityLabel("Horizontal progress bar divide")
    }
}
