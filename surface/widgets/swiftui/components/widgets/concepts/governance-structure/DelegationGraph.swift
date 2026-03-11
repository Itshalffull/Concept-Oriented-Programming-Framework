import SwiftUI

// MARK: - Types

struct DelegationNode: Identifiable {
    let id: String
    let label: String
    var weight: Double?
    var avatar: String?
}

struct DelegationEdge: Identifiable {
    var id: String { "\(from)->\(to)" }
    let from: String
    let to: String
    var weight: Double?
}

// MARK: - State Machine

enum DelegationGraphState { case browsing, searching, selected, delegating, undelegating }
enum DelegationGraphEvent {
    case search(query: String)
    case selectDelegate(id: String)
    case switchView
    case clearSearch
    case deselect
    case beginDelegate
    case beginUndelegate
    case delegateComplete
    case undelegateComplete
}

func delegationGraphReduce(state: DelegationGraphState, event: DelegationGraphEvent) -> DelegationGraphState {
    switch state {
    case .browsing:
        switch event {
        case .search: return .searching
        case .selectDelegate: return .selected
        case .switchView: return .browsing
        default: return state
        }
    case .searching:
        switch event {
        case .clearSearch: return .browsing
        case .selectDelegate: return .selected
        default: return state
        }
    case .selected:
        switch event {
        case .deselect: return .browsing
        case .beginDelegate: return .delegating
        case .beginUndelegate: return .undelegating
        default: return state
        }
    case .delegating:
        if case .delegateComplete = event { return .browsing }
        return state
    case .undelegating:
        if case .undelegateComplete = event { return .browsing }
        return state
    }
}

private func computeEffWeight(_ nodeId: String, nodes: [DelegationNode], edges: [DelegationEdge], visited: Set<String> = []) -> Double {
    if visited.contains(nodeId) { return 0 }
    var v = visited; v.insert(nodeId)
    let base = nodes.first { $0.id == nodeId }?.weight ?? 1
    let incoming = edges.filter { $0.to == nodeId }
    var delegated = 0.0
    for edge in incoming {
        delegated += computeEffWeight(edge.from, nodes: nodes, edges: edges, visited: v) * (edge.weight ?? 1)
    }
    return base + delegated
}

private func fmtW(_ w: Double) -> String {
    w == w.rounded() ? String(Int(w)) : String(format: "%.2f", w)
}

// MARK: - View

struct DelegationGraphView: View {
    let nodes: [DelegationNode]
    let edges: [DelegationEdge]
    var currentUserId: String?
    var sortBy: String = "power"
    var showCurrentDelegation: Bool = true
    var onDelegate: ((String, String) -> Void)?
    var onUndelegate: ((String, String) -> Void)?
    var onSelectNode: ((String) -> Void)?

    @State private var widgetState: DelegationGraphState = .browsing
    @State private var searchQuery: String = ""
    @State private var selectedNodeId: String? = nil

    private var nodeWeights: [String: Double] {
        var w: [String: Double] = [:]
        for n in nodes { w[n.id] = computeEffWeight(n.id, nodes: nodes, edges: edges) }
        return w
    }

    private var filteredNodes: [DelegationNode] {
        var result = nodes
        if !searchQuery.isEmpty {
            let q = searchQuery.lowercased()
            result = result.filter { $0.label.lowercased().contains(q) }
        }
        return result.sorted { (nodeWeights[$0.id] ?? 0) > (nodeWeights[$1.id] ?? 0) }
    }

    private var currentDelegation: (id: String, label: String, weight: Double)? {
        guard let uid = currentUserId, let edge = edges.first(where: { $0.from == uid }),
              let target = nodes.first(where: { $0.id == edge.to }) else { return nil }
        return (target.id, target.label, edge.weight ?? 1)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            TextField("Search delegates\u{2026}", text: $searchQuery)
                .textFieldStyle(.roundedBorder)
                .padding(.horizontal, 12).padding(.vertical, 8)
                .onChange(of: searchQuery) { val in
                    if !val.isEmpty && widgetState == .browsing {
                        widgetState = delegationGraphReduce(state: widgetState, event: .search(query: val))
                    } else if val.isEmpty && widgetState == .searching {
                        widgetState = delegationGraphReduce(state: widgetState, event: .clearSearch)
                    }
                }
                .accessibilityLabel("Search delegates by name")

            if showCurrentDelegation {
                HStack {
                    if let d = currentDelegation {
                        Text("Delegating to \(d.label) (weight: \(fmtW(d.weight)))").font(.caption)
                    } else {
                        Text("Not currently delegating").font(.caption).foregroundColor(.secondary)
                    }
                }.padding(.horizontal, 12).padding(.bottom, 8)
            }

            Divider()

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(filteredNodes) { node in
                        let ew = nodeWeights[node.id] ?? 0
                        let isSelected = selectedNodeId == node.id
                        let isDelegatedTo = currentUserId != nil && edges.contains { $0.from == currentUserId! && $0.to == node.id }

                        HStack(spacing: 8) {
                            Text(node.avatar ?? String(node.label.prefix(1)).uppercased())
                                .font(.caption).fontWeight(.bold).frame(width: 28, height: 28)
                                .background(Circle().fill(Color.gray.opacity(0.2)))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(node.label).fontWeight(.medium)
                                Text("Power: \(fmtW(ew))").font(.caption).foregroundColor(.secondary)
                            }
                            Spacer()
                            if let uid = currentUserId, node.id != uid {
                                Button(isDelegatedTo ? "Undelegate" : "Delegate") {
                                    if isDelegatedTo {
                                        widgetState = delegationGraphReduce(state: widgetState, event: .beginUndelegate)
                                        onUndelegate?(uid, node.id)
                                        widgetState = delegationGraphReduce(state: widgetState, event: .undelegateComplete)
                                    } else {
                                        widgetState = delegationGraphReduce(state: widgetState, event: .beginDelegate)
                                        onDelegate?(uid, node.id)
                                        widgetState = delegationGraphReduce(state: widgetState, event: .delegateComplete)
                                    }
                                }.font(.caption)
                            }
                        }
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(isSelected ? Color.blue.opacity(0.1) : Color.clear)
                        .contentShape(Rectangle())
                        .onTapGesture {
                            selectedNodeId = node.id
                            widgetState = delegationGraphReduce(state: widgetState, event: .selectDelegate(id: node.id))
                            onSelectNode?(node.id)
                        }
                        .accessibilityLabel("\(node.label), voting power: \(fmtW(ew))")
                    }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Delegation management")
    }
}
