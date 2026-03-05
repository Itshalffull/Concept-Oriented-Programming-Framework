import SwiftUI

struct SlaTimerView: View {
    var dueAt: String
    var status: String

    enum WidgetState { 
        case onTrack
        case warning
        case critical
        case breached
        case paused
     }
    @State private var state: WidgetState = .onTrack

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Remaining time display")
                .font(.body)
            Text("Current phase name")
                .font(.body)
            VStack { /* progressBar: Elapsed progress bar with phase coloring */ }
            Text("Elapsed time since start")
                .font(.body)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Five-state countdown timer for service l")
    }
}
