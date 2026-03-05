import SwiftUI

struct PromptEditorView: View {
    var systemPrompt: String? = nil
    var userPrompt: String
    var model: String
    var tools: [Any]

    enum WidgetState { 
        case editing
        case testing
        case viewing
     }
    @State private var state: WidgetState = .editing

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            VStack { /* systemBlock: System prompt message block */ }
            VStack { /* userBlock: User prompt message block with variable highlighting */ }
            VStack { /* variablePills: Auto-detected template variables */ }
            VStack { /* modelBadge: Model name badge */ }
            Text("Estimated token count")
                .font(.body)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Multi-message prompt template editor for")
    }
}
