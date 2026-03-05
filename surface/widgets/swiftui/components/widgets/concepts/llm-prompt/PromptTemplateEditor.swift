import SwiftUI

struct PromptTemplateEditorView: View {
    var messages: [Any]
    var variables: [Any]
    var modelId: String? = nil

    enum WidgetState { 
        case editing
        case messageSelected
        case compiling
     }
    @State private var state: WidgetState = .editing

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            VStack { /* messageList: Ordered list of prompt messages */ }
            VStack { /* messageBlock: Single message with role selector and textarea */ }
            VStack { /* roleSelector: Role dropdown (system, user, assistant) */ }
            VStack { /* templateInput: Textarea with variable syntax highlighting */ }
            VStack { /* variablePills: Auto-detected variable tags */ }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Multi-message prompt template editor wit")
    }
}
