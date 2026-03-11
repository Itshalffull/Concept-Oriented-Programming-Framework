import SwiftUI

// State machine: idle | guardSelected
enum GuardStatusPanelWatchState {
    case idle
    case guardSelected
}

enum GuardStatusPanelWatchEvent {
    case selectGuard(String)
    case guardTrip
    case deselect
}

func guardStatusPanelWatchReduce(_ state: GuardStatusPanelWatchState, _ event: GuardStatusPanelWatchEvent) -> GuardStatusPanelWatchState {
    switch state {
    case .idle:
        switch event {
        case .selectGuard: return .guardSelected
        case .guardTrip: return .idle
        default: return state
        }
    case .guardSelected:
        if case .deselect = event { return .idle }
        return state
    }
}

struct GuardData: Identifiable {
    var id: String { name }
    let name: String
    let description: String
    let status: String // "passing", "failing", "pending", "bypassed"
    var lastChecked: String? = nil
}

struct GuardStatusPanelWatchView: View {
    let guards: [GuardData]
    let executionStatus: String
    var onGuardSelect: ((GuardData) -> Void)? = nil

    @State private var state: GuardStatusPanelWatchState = .idle
    @State private var selectedGuardName: String? = nil

    private var passingCount: Int { guards.filter { $0.status == "passing" }.count }
    private var hasBlocking: Bool { guards.contains { $0.status == "failing" } }

    private func statusIcon(_ status: String) -> String {
        switch status {
        case "passing": return "\u{2713}"
        case "failing": return "\u{2717}"
        case "pending": return "\u{23F3}"
        case "bypassed": return "\u{2298}"
        default: return "\u{2022}"
        }
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "passing": return .green
        case "failing": return .red
        case "pending": return .orange
        case "bypassed": return .secondary
        default: return .primary
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                Text("Guards")
                    .font(.caption2).fontWeight(.bold)
                Text("\(passingCount)/\(guards.count) passing")
                    .font(.system(size: 9)).foregroundColor(.secondary)

                if hasBlocking {
                    HStack(spacing: 4) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 9)).foregroundColor(.red)
                        Text("Blocked")
                            .font(.system(size: 9)).foregroundColor(.red)
                    }
                }

                Divider()

                ForEach(guards) { guard_ in
                    let isSelected = selectedGuardName == guard_.name
                    Button {
                        if isSelected {
                            selectedGuardName = nil
                            state = guardStatusPanelWatchReduce(state, .deselect)
                        } else {
                            selectedGuardName = guard_.name
                            state = guardStatusPanelWatchReduce(state, .selectGuard(guard_.name))
                            onGuardSelect?(guard_)
                        }
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 4) {
                                Text(statusIcon(guard_.status))
                                    .foregroundColor(statusColor(guard_.status))
                                    .font(.system(size: 10))
                                Text(guard_.name)
                                    .font(.caption2)
                                    .lineLimit(1)
                                Spacer()
                                Text(guard_.status.capitalized)
                                    .font(.system(size: 8))
                                    .foregroundColor(statusColor(guard_.status))
                            }
                            if isSelected {
                                Text(guard_.description)
                                    .font(.system(size: 8))
                                    .foregroundColor(.secondary)
                                if let lastChecked = guard_.lastChecked {
                                    Text("Checked: \(lastChecked)")
                                        .font(.system(size: 7))
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                        .padding(.vertical, 2)
                        .background(isSelected ? Color.blue.opacity(0.1) : Color.clear)
                        .cornerRadius(3)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 4)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Pre-execution guards: \(passingCount) of \(guards.count) passing")
    }
}
