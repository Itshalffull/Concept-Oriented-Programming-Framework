import SwiftUI

// State machine: empty | composing | submitting
enum PromptInputWatchState {
    case empty
    case composing
    case submitting
}

enum PromptInputWatchEvent {
    case type
    case clear
    case submit
    case submitComplete
}

func promptInputWatchReduce(_ state: PromptInputWatchState, _ event: PromptInputWatchEvent) -> PromptInputWatchState {
    switch state {
    case .empty:
        if case .type = event { return .composing }
        return state
    case .composing:
        switch event {
        case .clear: return .empty
        case .submit: return .submitting
        default: return state
        }
    case .submitting:
        if case .submitComplete = event { return .empty }
        return state
    }
}

struct PromptInputWatchView: View {
    @Binding var text: String
    var placeholder: String = "Message..."
    var isSubmitting: Bool = false
    var onSubmit: ((String) -> Void)? = nil

    @State private var state: PromptInputWatchState = .empty

    var body: some View {
        VStack(spacing: 4) {
            // Text field (simplified for watch)
            TextField(placeholder, text: $text)
                .font(.caption2)
                .onChange(of: text) { _, newValue in
                    if newValue.isEmpty {
                        state = promptInputWatchReduce(state, .clear)
                    } else if state == .empty {
                        state = promptInputWatchReduce(state, .type)
                    }
                }

            // Submit button
            Button {
                guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
                state = promptInputWatchReduce(state, .submit)
                onSubmit?(text)
                text = ""
                state = promptInputWatchReduce(state, .submitComplete)
            } label: {
                HStack {
                    if isSubmitting {
                        ProgressView().scaleEffect(0.5)
                    } else {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.caption)
                    }
                    Text(isSubmitting ? "Sending..." : "Send")
                        .font(.caption2)
                }
            }
            .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSubmitting)
            .buttonStyle(.borderedProminent)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Prompt input")
    }
}
