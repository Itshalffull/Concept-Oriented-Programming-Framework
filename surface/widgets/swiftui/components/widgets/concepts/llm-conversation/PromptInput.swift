import SwiftUI

// MARK: - State Machine

enum PromptInputState { case empty, composing, submitting }
enum PromptInputEvent { case input, clear, submit, complete }

func promptInputReduce(state: PromptInputState, event: PromptInputEvent) -> PromptInputState {
    switch state {
    case .empty:
        if case .input = event { return .composing }
        return state
    case .composing:
        switch event {
        case .clear: return .empty
        case .submit: return .submitting
        default: return state
        }
    case .submitting:
        if case .complete = event { return .empty }
        return state
    }
}

// MARK: - View

struct PromptInputView: View {
    var placeholder: String = "Type a message\u{2026}"
    var maxLength: Int?
    var showCharCount: Bool = false
    var disabled: Bool = false
    var onSubmit: ((String) -> Void)?
    var onChange: ((String) -> Void)?

    @State private var widgetState: PromptInputState = .empty
    @State private var text: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .bottom, spacing: 8) {
                TextEditor(text: $text)
                    .font(.system(size: 14))
                    .frame(minHeight: 36, maxHeight: 120)
                    .overlay(
                        Group {
                            if text.isEmpty {
                                Text(placeholder).foregroundColor(.secondary).font(.system(size: 14))
                                    .padding(.horizontal, 4).padding(.vertical, 8)
                                    .allowsHitTesting(false)
                            }
                        },
                        alignment: .topLeading
                    )
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.gray.opacity(0.3)))
                    .disabled(disabled || widgetState == .submitting)
                    .onChange(of: text) { val in
                        if val.isEmpty && widgetState == .composing {
                            widgetState = promptInputReduce(state: widgetState, event: .clear)
                        } else if !val.isEmpty && widgetState == .empty {
                            widgetState = promptInputReduce(state: widgetState, event: .input)
                        }
                        if let ml = maxLength, val.count > ml { text = String(val.prefix(ml)) }
                        onChange?(text)
                    }
                    .accessibilityLabel("Message input")

                Button(action: handleSubmit) {
                    Text(widgetState == .submitting ? "\u{2026}" : "\u{2191}")
                        .font(.system(size: 18))
                        .frame(width: 36, height: 36)
                }
                .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || disabled || widgetState == .submitting)
                .accessibilityLabel("Send message")
            }

            if showCharCount {
                HStack {
                    Spacer()
                    Text(maxLength != nil ? "\(text.count)/\(maxLength!)" : "\(text.count)")
                        .font(.caption2).foregroundColor(.secondary)
                }
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Prompt input")
    }

    private func handleSubmit() {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        widgetState = promptInputReduce(state: widgetState, event: .submit)
        onSubmit?(trimmed)
        text = ""
        widgetState = promptInputReduce(state: widgetState, event: .complete)
    }
}
