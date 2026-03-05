import SwiftUI

struct GenerationIndicatorView: View {
    var status: String
    var model: String? = nil
    var tokenCount: Int? = nil

    enum WidgetState { 
        case idle
        case generating
        case complete
        case error
     }
    @State private var state: WidgetState = .idle

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            VStack { /* spinner: Animated dots or spinner */ }
            Text("Status label (Thinking, Generating, Complete)")
                .font(.body)
            VStack { /* modelBadge: Badge showing the active model name */ }
            Text("Running token count during generation")
                .font(.body)
            Text("Elapsed time display")
                .font(.body)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Status indicator for LLM generation in p")
    }
}
