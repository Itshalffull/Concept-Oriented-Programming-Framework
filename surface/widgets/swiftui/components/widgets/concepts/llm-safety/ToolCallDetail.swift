import SwiftUI

struct ToolCallDetailView: View {
    var toolName: String
    var arguments: String
    var result: String? = nil
    var timing: Int? = nil
    var tokenUsage: Int? = nil
    var error: String? = nil

    enum WidgetState { 
        case idle
        case retrying
     }
    @State private var state: WidgetState = .idle

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            VStack { /* header: Tool name and status */ }
            Text("Tool function name")
                .font(.body)
            VStack { /* statusBadge: Execution status indicator */ }
            VStack { /* argumentsPanel: Formatted arguments display */ }
            VStack { /* resultPanel: Formatted result display */ }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Detailed view of a single tool call with")
    }
}
