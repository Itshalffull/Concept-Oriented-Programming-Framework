import SwiftUI

enum ProofGoalStatus: String { case open, proved, failed, skipped }

struct ProofGoal: Identifiable {
    let id: String
    let label: String
    let status: ProofGoalStatus
    var tactic: String?
    var children: [ProofGoal]?
    var progress: Double?
    var statusIcon: String {
        switch status {
        case .proved: return "\u{2713}"
        case .failed: return "\u{2717}"
        case .open: return "\u{25CB}"
        case .skipped: return "\u{2298}"
        }
    }
}

enum ProofSessionTreeWidgetState { case idle, selected }

struct ProofSessionTreeView: View {
    let goals: [ProofGoal]
    var selectedId: String?
    var onSelectGoal: ((String?) -> Void)?

    @State private var internalSelectedId: String?
    @State private var expandedIds: Set<String> = []

    private var effectiveSelectedId: String? { selectedId ?? internalSelectedId }

    private func countGoals(_ gs: [ProofGoal]) -> (Int, Int) {
        var t = 0, p = 0
        for g in gs { t += 1; if g.status == .proved { p += 1 }; if let c = g.children { let r = countGoals(c); t += r.0; p += r.1 } }
        return (t, p)
    }

    private func findGoal(_ gs: [ProofGoal], _ id: String) -> ProofGoal? {
        for g in gs { if g.id == id { return g }; if let f = g.children.flatMap({ findGoal($0, id) }) { return f } }
        return nil
    }

    var body: some View {
        let (total, proved) = countGoals(goals)
        VStack(alignment: .leading, spacing: 4) {
            Text("\(proved) of \(total) goals proved").font(.subheadline).foregroundColor(.secondary)
            ForEach(goals) { g in goalRow(g, depth: 0) }
            if let sid = effectiveSelectedId, let sel = findGoal(goals, sid) {
                Divider()
                VStack(alignment: .leading, spacing: 4) {
                    HStack { Text("\(sel.statusIcon) \(sel.status.rawValue.capitalized)"); Spacer()
                        Button("\u{2715}") { internalSelectedId = nil; onSelectGoal?(nil) }.buttonStyle(.plain)
                    }
                    Text("Goal: \(sel.label)").font(.subheadline)
                    if let t = sel.tactic { Text("Tactic: \(t)").font(.caption) }
                    if let p = sel.progress { Text("Progress: \(Int(p * 100))%").font(.caption) }
                }.padding(8)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Proof session tree")
    }

    @ViewBuilder
    private func goalRow(_ goal: ProofGoal, depth: Int) -> some View {
        let hasChildren = goal.children?.isEmpty == false
        let isExpanded = expandedIds.contains(goal.id)
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 6) {
                if hasChildren {
                    Button(isExpanded ? "\u{25BC}" : "\u{25B6}") {
                        if expandedIds.contains(goal.id) { expandedIds.remove(goal.id) } else { expandedIds.insert(goal.id) }
                    }.buttonStyle(.plain).font(.caption)
                } else { Text(" ").frame(width: 16) }
                Text(goal.statusIcon)
                Text(goal.label)
                Spacer()
            }
            .padding(.leading, CGFloat(depth * 20)).padding(.vertical, 2)
            .background(effectiveSelectedId == goal.id ? Color.accentColor.opacity(0.15) : Color.clear)
            .cornerRadius(4)
            .contentShape(Rectangle())
            .onTapGesture { let next = effectiveSelectedId == goal.id ? nil : goal.id; internalSelectedId = next; onSelectGoal?(next) }
            .accessibilityLabel("\(goal.label), \(goal.status.rawValue)")
            if hasChildren && isExpanded { ForEach(goal.children ?? []) { c in goalRow(c, depth: depth + 1) } }
        }
    }
}
