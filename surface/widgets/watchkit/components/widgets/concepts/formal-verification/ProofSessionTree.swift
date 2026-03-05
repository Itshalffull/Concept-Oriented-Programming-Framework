import SwiftUI

// State machine: idle | selected
enum ProofSessionTreeWatchState {
    case idle
    case selected
}

enum ProofSessionTreeWatchEvent {
    case select
    case deselect
    case expand
    case collapse
}

func proofSessionTreeWatchReduce(_ state: ProofSessionTreeWatchState, _ event: ProofSessionTreeWatchEvent) -> ProofSessionTreeWatchState {
    switch state {
    case .idle:
        if case .select = event { return .selected }
        return state
    case .selected:
        if case .deselect = event { return .idle }
        if case .select = event { return .selected }
        return state
    }
}

struct ProofGoal: Identifiable {
    let id: String
    let label: String
    let status: String // "open", "proved", "failed", "skipped"
    var tactic: String? = nil
    var children: [ProofGoal] = []
    var progress: Double? = nil
}

struct ProofSessionTreeWatchView: View {
    let goals: [ProofGoal]
    var onSelectGoal: ((String?) -> Void)? = nil

    @State private var state: ProofSessionTreeWatchState = .idle
    @State private var selectedId: String? = nil
    @State private var expandedIds: Set<String> = []

    private var totalGoals: Int {
        countGoals(goals)
    }

    private var provedGoals: Int {
        countProved(goals)
    }

    private func countGoals(_ nodes: [ProofGoal]) -> Int {
        nodes.reduce(0) { $0 + 1 + countGoals($1.children) }
    }

    private func countProved(_ nodes: [ProofGoal]) -> Int {
        nodes.reduce(0) { $0 + ($1.status == "proved" ? 1 : 0) + countProved($1.children) }
    }

    private func statusIcon(_ status: String) -> String {
        switch status {
        case "proved": return "\u{2713}"
        case "failed": return "\u{2717}"
        case "open": return "\u{25CB}"
        case "skipped": return "\u{2298}"
        default: return "\u{2022}"
        }
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "proved": return .green
        case "failed": return .red
        case "open": return .blue
        case "skipped": return .secondary
        default: return .primary
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                // Summary
                Text("\(provedGoals)/\(totalGoals) proved")
                    .font(.caption2)
                    .fontWeight(.semibold)

                ProgressView(value: totalGoals > 0 ? Double(provedGoals) / Double(totalGoals) : 0)
                    .tint(.green)

                // Tree
                ForEach(goals) { goal in
                    goalRow(goal, depth: 0)
                }

                // Detail panel
                if let selId = selectedId, let goal = findGoal(in: goals, id: selId) {
                    Divider()
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 4) {
                            Text(statusIcon(goal.status))
                                .foregroundColor(statusColor(goal.status))
                            Text(goal.label)
                                .font(.caption2)
                                .fontWeight(.bold)
                        }
                        Text(goal.status.capitalized)
                            .font(.system(size: 9))
                            .foregroundColor(statusColor(goal.status))
                        if let tactic = goal.tactic {
                            Text("Tactic: \(tactic)")
                                .font(.system(size: 9))
                                .foregroundColor(.secondary)
                        }
                        if let progress = goal.progress {
                            Text("\(Int(progress * 100))% complete")
                                .font(.system(size: 9))
                                .foregroundColor(.secondary)
                        }
                        if !goal.children.isEmpty {
                            Text("\(goal.children.count) sub-goals")
                                .font(.system(size: 9))
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
            .padding(.horizontal, 4)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Proof session tree: \(provedGoals) of \(totalGoals) goals proved")
    }

    @ViewBuilder
    private func goalRow(_ goal: ProofGoal, depth: Int) -> some View {
        let hasChildren = !goal.children.isEmpty
        let isExpanded = expandedIds.contains(goal.id)
        let isSelected = selectedId == goal.id

        Button {
            if isSelected {
                selectedId = nil
                state = proofSessionTreeWatchReduce(state, .deselect)
                onSelectGoal?(nil)
            } else {
                selectedId = goal.id
                state = proofSessionTreeWatchReduce(state, .select)
                onSelectGoal?(goal.id)
            }
        } label: {
            HStack(spacing: 2) {
                if hasChildren {
                    Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                        .font(.system(size: 8))
                        .foregroundColor(.secondary)
                        .onTapGesture {
                            if isExpanded {
                                expandedIds.remove(goal.id)
                            } else {
                                expandedIds.insert(goal.id)
                            }
                        }
                } else {
                    Spacer().frame(width: 10)
                }

                Text(statusIcon(goal.status))
                    .foregroundColor(statusColor(goal.status))
                    .font(.system(size: 10))

                Text(goal.label)
                    .font(.caption2)
                    .lineLimit(1)
            }
            .padding(.leading, CGFloat(depth * 12))
            .padding(.vertical, 1)
            .background(isSelected ? Color.blue.opacity(0.15) : Color.clear)
            .cornerRadius(2)
        }
        .buttonStyle(.plain)

        if hasChildren && isExpanded {
            ForEach(goal.children) { child in
                goalRow(child, depth: depth + 1)
            }
        }
    }

    private func findGoal(in goals: [ProofGoal], id: String) -> ProofGoal? {
        for goal in goals {
            if goal.id == id { return goal }
            if let found = findGoal(in: goal.children, id: id) { return found }
        }
        return nil
    }
}
