import SwiftUI

// State machine: browsing | selected (simplified for watch - no searching/delegating)
enum DelegationGraphWatchState {
    case browsing
    case selected
}

enum DelegationGraphWatchEvent {
    case selectNode(String)
    case deselect
}

func delegationGraphWatchReduce(_ state: DelegationGraphWatchState, _ event: DelegationGraphWatchEvent) -> DelegationGraphWatchState {
    switch state {
    case .browsing:
        if case .selectNode = event { return .selected }
        return state
    case .selected:
        switch event {
        case .deselect: return .browsing
        case .selectNode: return .selected
        default: return state
        }
    }
}

struct DelegationNodeData: Identifiable {
    let id: String
    let label: String
    var weight: Double = 0
    var isDelegator: Bool = false
}

struct DelegationEdgeData: Identifiable {
    var id: String { "\(from)-\(to)" }
    let from: String
    let to: String
    var weight: Double = 1.0
}

struct DelegationGraphWatchView: View {
    let nodes: [DelegationNodeData]
    let edges: [DelegationEdgeData]
    var onSelectNode: ((String?) -> Void)? = nil

    @State private var state: DelegationGraphWatchState = .browsing
    @State private var selectedNodeId: String? = nil

    private func delegatesTo(_ nodeId: String) -> [DelegationNodeData] {
        let toIds = Set(edges.filter { $0.from == nodeId }.map { $0.to })
        return nodes.filter { toIds.contains($0.id) }
    }

    private func delegatesFrom(_ nodeId: String) -> [DelegationNodeData] {
        let fromIds = Set(edges.filter { $0.to == nodeId }.map { $0.from })
        return nodes.filter { fromIds.contains($0.id) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                Text("Delegations").font(.caption2).fontWeight(.bold)
                Text("\(nodes.count) participants").font(.system(size: 9)).foregroundColor(.secondary)

                Divider()

                ForEach(nodes) { node in
                    Button {
                        if selectedNodeId == node.id {
                            selectedNodeId = nil
                            state = delegationGraphWatchReduce(state, .deselect)
                            onSelectNode?(nil)
                        } else {
                            selectedNodeId = node.id
                            state = delegationGraphWatchReduce(state, .selectNode(node.id))
                            onSelectNode?(node.id)
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: node.isDelegator ? "arrow.right.circle" : "person.circle")
                                .font(.system(size: 10))
                                .foregroundColor(node.isDelegator ? .orange : .blue)
                            VStack(alignment: .leading, spacing: 0) {
                                Text(node.label).font(.caption2)
                                if node.weight > 0 {
                                    Text("Weight: \(String(format: "%.1f", node.weight))")
                                        .font(.system(size: 7)).foregroundColor(.secondary)
                                }
                            }
                        }
                        .padding(.vertical, 1)
                        .background(selectedNodeId == node.id ? Color.blue.opacity(0.1) : Color.clear)
                        .cornerRadius(2)
                    }
                    .buttonStyle(.plain)
                }

                if let selId = selectedNodeId, let node = nodes.first(where: { $0.id == selId }) {
                    Divider()
                    VStack(alignment: .leading, spacing: 2) {
                        Text(node.label).font(.caption2).fontWeight(.bold)
                        let delegatees = delegatesTo(selId)
                        if !delegatees.isEmpty {
                            Text("Delegates to (\(delegatees.count))").font(.system(size: 8)).fontWeight(.semibold)
                            ForEach(delegatees) { d in Text(d.label).font(.system(size: 8)) }
                        }
                        let delegators = delegatesFrom(selId)
                        if !delegators.isEmpty {
                            Text("Delegated from (\(delegators.count))").font(.system(size: 8)).fontWeight(.semibold)
                            ForEach(delegators) { d in Text(d.label).font(.system(size: 8)) }
                        }
                    }
                }
            }
            .padding(.horizontal, 4)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Delegation graph with \(nodes.count) participants")
    }
}
