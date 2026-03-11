import SwiftUI

// MARK: - State Machine

enum MessageBranchNavState { case viewing, editing }
enum MessageBranchNavEvent { case edit, save, cancel, prev, next }

func messageBranchNavReduce(state: MessageBranchNavState, event: MessageBranchNavEvent) -> MessageBranchNavState {
    switch state {
    case .viewing:
        switch event {
        case .edit: return .editing
        case .prev, .next: return .viewing
        default: return state
        }
    case .editing:
        switch event {
        case .save, .cancel: return .viewing
        default: return state
        }
    }
}

// MARK: - View

struct MessageBranchNavView: View {
    let currentIndex: Int
    let totalBranches: Int
    var onPrevious: (() -> Void)?
    var onNext: (() -> Void)?
    var onEdit: (() -> Void)?
    var onSave: ((String) -> Void)?

    @State private var widgetState: MessageBranchNavState = .viewing
    @State private var editText: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                Button("\u{25C0}") {
                    widgetState = messageBranchNavReduce(state: widgetState, event: .prev)
                    onPrevious?()
                }
                .disabled(currentIndex <= 1)
                .accessibilityLabel("Previous branch")

                Text("\(currentIndex) / \(totalBranches)")
                    .font(.system(size: 13)).monospacedDigit()
                    .accessibilityLabel("Branch \(currentIndex) of \(totalBranches)")

                Button("\u{25B6}") {
                    widgetState = messageBranchNavReduce(state: widgetState, event: .next)
                    onNext?()
                }
                .disabled(currentIndex >= totalBranches)
                .accessibilityLabel("Next branch")

                Spacer()

                if widgetState == .viewing {
                    Button("Edit") {
                        widgetState = messageBranchNavReduce(state: widgetState, event: .edit)
                        onEdit?()
                    }.font(.caption)
                }
            }

            if widgetState == .editing {
                TextEditor(text: $editText)
                    .font(.system(size: 13))
                    .frame(minHeight: 60)
                    .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color.gray.opacity(0.3)))

                HStack {
                    Button("Save") {
                        widgetState = messageBranchNavReduce(state: widgetState, event: .save)
                        onSave?(editText)
                    }.font(.caption)
                    Button("Cancel") {
                        widgetState = messageBranchNavReduce(state: widgetState, event: .cancel)
                    }.font(.caption)
                }
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Message branch navigation")
    }
}
