import SwiftUI

struct ExecutionOverlayView: View {
    var status: String
    var activeStep: String? = nil
    var startedAt: String? = nil
    var endedAt: String? = nil

    enum WidgetState { 
        case idle
        case live
        case suspended
        case completed
        case failed
        case cancelled
        case replay
     }
    @State private var state: WidgetState = .idle

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            VStack { /* nodeOverlay: Per-node status highlight (colored border or background) */ }
            VStack { /* activeMarker: Pulsing indicator on the currently executing step */ }
            VStack { /* flowAnimation: Animated dots or dashes along active edges */ }
            VStack { /* statusBar: Bottom bar showing run status, elapsed time, and controls */ }
            VStack { /* controlButtons: Suspend, resume, and cancel action buttons */ }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Runtime state overlay for process execut")
    }
}
