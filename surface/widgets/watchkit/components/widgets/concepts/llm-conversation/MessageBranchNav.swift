import SwiftUI

// State machine: viewing (read-only on watch, no editing)
enum MessageBranchNavWatchState {
    case viewing
}

enum MessageBranchNavWatchEvent {
    case prev
    case next
}

func messageBranchNavWatchReduce(_ state: MessageBranchNavWatchState, _ event: MessageBranchNavWatchEvent) -> MessageBranchNavWatchState {
    return .viewing
}

struct MessageBranchNavWatchView: View {
    let currentIndex: Int
    let totalBranches: Int
    var onPrevious: (() -> Void)? = nil
    var onNext: (() -> Void)? = nil

    @State private var state: MessageBranchNavWatchState = .viewing

    var body: some View {
        HStack(spacing: 8) {
            Button {
                onPrevious?()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 10))
            }
            .disabled(currentIndex <= 0)
            .buttonStyle(.plain)

            Text("\(currentIndex + 1)/\(totalBranches)")
                .font(.system(size: 10, design: .monospaced))
                .fontWeight(.semibold)

            Button {
                onNext?()
            } label: {
                Image(systemName: "chevron.right")
                    .font(.system(size: 10))
            }
            .disabled(currentIndex >= totalBranches - 1)
            .buttonStyle(.plain)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Branch \(currentIndex + 1) of \(totalBranches)")
        .accessibilityHint("Navigate between message branches")
    }
}
