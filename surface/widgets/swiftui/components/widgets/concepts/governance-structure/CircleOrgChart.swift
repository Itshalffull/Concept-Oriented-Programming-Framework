import SwiftUI

// MARK: - Types

struct CircleMember: Identifiable {
    let id = UUID()
    let name: String
    let role: String
}

struct Circle: Identifiable {
    let id: String
    let name: String
    let purpose: String
    var parentId: String?
    var members: [CircleMember]
    var jurisdiction: String?
    var policies: [String]?
}

struct CircleTreeNode: Identifiable {
    var id: String { circle.id }
    let circle: Circle
    var children: [CircleTreeNode]
}

// MARK: - State Machine

enum CircleOrgChartState { case idle, circleSelected }
enum CircleOrgChartEvent {
    case selectCircle(id: String)
    case deselect
    case expand(id: String)
    case collapse(id: String)
}

func circleOrgChartReduce(state: CircleOrgChartState, event: CircleOrgChartEvent) -> CircleOrgChartState {
    switch state {
    case .idle:
        if case .selectCircle = event { return .circleSelected }
        return state
    case .circleSelected:
        switch event {
        case .deselect: return .idle
        case .selectCircle: return .circleSelected
        default: return state
        }
    }
}

func buildCircleTree(_ circles: [Circle]) -> [CircleTreeNode] {
    var byId: [String: CircleTreeNode] = [:]
    for c in circles { byId[c.id] = CircleTreeNode(circle: c, children: []) }
    var roots: [CircleTreeNode] = []
    for c in circles {
        if let pid = c.parentId, byId[pid] != nil {
            byId[pid]!.children.append(byId[c.id]!)
        } else {
            roots.append(byId[c.id]!)
        }
    }
    return roots
}

// MARK: - View

struct CircleOrgChartView: View {
    let circles: [Circle]
    var layout: String = "tree"
    var showPolicies: Bool = true
    var showJurisdiction: Bool = true
    var maxAvatars: Int = 5
    var onSelectCircle: ((String?) -> Void)?

    @State private var widgetState: CircleOrgChartState = .idle
    @State private var selectedId: String? = nil
    @State private var expandedIds: Set<String> = []

    private var tree: [CircleTreeNode] { buildCircleTree(circles) }
    private var selectedCircle: Circle? { circles.first { $0.id == selectedId } }

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(tree) { node in
                        circleNode(node, depth: 0)
                    }
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Governance circles")

            if widgetState == .circleSelected, let circle = selectedCircle {
                Divider()
                detailPanel(circle).frame(width: 260)
            }
        }
    }

    @ViewBuilder
    private func circleNode(_ node: CircleTreeNode, depth: Int) -> some View {
        let isExpanded = expandedIds.contains(node.circle.id)
        let isSelected = selectedId == node.circle.id
        let hasChildren = !node.children.isEmpty

        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                if hasChildren {
                    Button(action: { toggleExpand(node.circle.id) }) {
                        Text(isExpanded ? "\u{25BC}" : "\u{25B6}").font(.system(size: 10))
                    }.buttonStyle(.plain)
                }
                Text(node.circle.name).fontWeight(.semibold)
                Text("\(node.circle.members.count) member\(node.circle.members.count != 1 ? "s" : "")")
                    .font(.caption).foregroundColor(.secondary)
                Spacer()
                if showJurisdiction, let j = node.circle.jurisdiction {
                    Text(j).font(.caption2).padding(.horizontal, 4).background(Color.gray.opacity(0.15)).cornerRadius(3)
                }
            }
            .padding(.leading, CGFloat(depth * 24))
            .padding(.vertical, 6).padding(.horizontal, 8)
            .background(isSelected ? Color.blue.opacity(0.12) : Color.clear)
            .contentShape(Rectangle())
            .onTapGesture { selectCircle(node.circle.id) }
            .accessibilityLabel("\(node.circle.name): \(node.circle.purpose)")

            if showPolicies, let policies = node.circle.policies, !policies.isEmpty {
                HStack(spacing: 4) {
                    ForEach(policies, id: \.self) { p in
                        Text(p).font(.caption2).padding(.horizontal, 4).padding(.vertical, 1)
                            .background(Color.blue.opacity(0.1)).cornerRadius(3)
                    }
                }.padding(.leading, CGFloat(depth * 24 + 28)).padding(.bottom, 4)
            }

            HStack(spacing: -4) {
                ForEach(Array(node.circle.members.prefix(maxAvatars).enumerated()), id: \.offset) { _, m in
                    Text(String(m.name.prefix(1)).uppercased())
                        .font(.caption2).fontWeight(.bold).frame(width: 22, height: 22)
                        .background(Circle().fill(Color.gray.opacity(0.2)))
                        .accessibilityLabel("\(m.name), \(m.role)")
                }
                if node.circle.members.count > maxAvatars {
                    Text("+\(node.circle.members.count - maxAvatars)")
                        .font(.caption2).frame(width: 22, height: 22)
                        .background(Circle().fill(Color.gray.opacity(0.15)))
                }
            }.padding(.leading, CGFloat(depth * 24 + 28)).padding(.bottom, 4)

            if hasChildren && isExpanded {
                ForEach(node.children) { child in circleNode(child, depth: depth + 1) }
            }
        }
    }

    @ViewBuilder
    private func detailPanel(_ circle: Circle) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(circle.name).font(.headline)
                Spacer()
                Button(action: { deselectCircle() }) { Text("\u{2715}") }.buttonStyle(.plain)
                    .accessibilityLabel("Close detail panel")
            }
            Group {
                Text("Purpose").font(.caption).foregroundColor(.secondary)
                Text(circle.purpose)
            }
            if let j = circle.jurisdiction {
                Text("Jurisdiction").font(.caption).foregroundColor(.secondary)
                Text(j)
            }
            if let p = circle.policies, !p.isEmpty {
                Text("Policies").font(.caption).foregroundColor(.secondary)
                Text(p.joined(separator: ", "))
            }
            Text("Members (\(circle.members.count))").font(.caption).foregroundColor(.secondary)
            ForEach(circle.members) { m in
                HStack { Text(m.name); Spacer(); Text(m.role).foregroundColor(.secondary) }.font(.system(size: 13))
            }
            Spacer()
        }.padding()
    }

    private func selectCircle(_ id: String) {
        if selectedId == id { deselectCircle(); return }
        selectedId = id
        widgetState = circleOrgChartReduce(state: widgetState, event: .selectCircle(id: id))
        onSelectCircle?(id)
    }

    private func deselectCircle() {
        selectedId = nil
        widgetState = circleOrgChartReduce(state: widgetState, event: .deselect)
        onSelectCircle?(nil)
    }

    private func toggleExpand(_ id: String) {
        if expandedIds.contains(id) { expandedIds.remove(id) } else { expandedIds.insert(id) }
    }
}
