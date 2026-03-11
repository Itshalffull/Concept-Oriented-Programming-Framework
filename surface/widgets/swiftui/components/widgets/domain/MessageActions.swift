import SwiftUI

struct MessageActionsView: View {
    var messageId: String

    enum WidgetState { 
        case hidden
        case visible
        case copied
     }
    @State private var state: WidgetState = .hidden

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Button("Positive feedback button") { /* action */ }
            Button("Negative feedback button") { /* action */ }
            Button("Copy message content") { /* action */ }
            Button("Regenerate this response") { /* action */ }
            Button("Edit this message") { /* action */ }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Hover-revealed toolbar for chat message ")
    }
}
